import React, { useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../utils/axios';
import ProductsPage from './ProductsPage';

const WEIGHT_HEADERS = new Set([
  'is weight based',
  'is_weight_based',
  'weight based',
  'weight_based',
  'weightbased',
  'isweightbased',
  'product type',
  'product_type',
  'producttype',
  'unit type',
  'unit_type',
  'unittype',
  'type',
]);

const normalizeHeader = (value) =>
  String(value || '')
    .replace(/[\uFEFF\u200B-\u200D\u2060\u00A0]/g, '')
    .trim()
    .toLowerCase();

const normalizeWeightFlag = (value, fallback = '0') => {
  if (value === null || value === undefined || value === '') return fallback;
  if (value === true) return '1';
  if (value === false) return '0';
  if (typeof value === 'number') return value !== 0 ? '1' : '0';
  const normalized = String(value).trim().toLowerCase();
  if (
    ['1', 'true', 'yes', 'y', 'weight', 'weighted', 'weight based', 'weight-based', 'kg', 'kgs', 'gram', 'grams'].includes(normalized)
  ) {
    return '1';
  }
  if (
    ['0', 'false', 'no', 'n', 'piece', 'pieces', 'piece based', 'piece-based', 'pcs', 'pc', 'unit', 'units'].includes(normalized)
  ) {
    return '0';
  }
  return fallback;
};

const rowKey = (row = {}) => {
  const barcode = String(row?.barcode || '').trim().toLowerCase();
  const name = String(row?.name || row?.product_name || '').trim().toLowerCase();
  return `${barcode}|${name}`;
};

const parseWeightRows = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!Array.isArray(matrix) || matrix.length === 0) return [];

  let headerRowIndex = 0;
  let weightColumnIndex = -1;
  let bestScore = -1;
  const scanLimit = Math.min(matrix.length, 10);
  for (let i = 0; i < scanLimit; i += 1) {
    const row = Array.isArray(matrix[i]) ? matrix[i] : [];
    const normalized = row.map(normalizeHeader);
    const currentWeightIndex = normalized.findIndex((header) => WEIGHT_HEADERS.has(header));
    const score = normalized.filter((header) =>
      ['product name', 'product_name', 'name', 'barcode', 'selling price', 'selling_price', 'purchase price', 'purchase_price', 'stock', 'quantity', 'qty'].includes(header)
    ).length + (currentWeightIndex >= 0 ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      headerRowIndex = i;
      weightColumnIndex = currentWeightIndex;
    }
  }

  const headers = (matrix[headerRowIndex] || []).map(normalizeHeader);
  if (weightColumnIndex < 0) {
    weightColumnIndex = headers.findIndex((header) => WEIGHT_HEADERS.has(header));
  }
  const nameIndex = headers.findIndex((header) => ['product name', 'product_name', 'name'].includes(header));
  const barcodeIndex = headers.findIndex((header) => header === 'barcode');

  return matrix
    .slice(headerRowIndex + 1)
    .filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== ''))
    .map((row, index) => ({
      index,
      name: nameIndex >= 0 ? String(row[nameIndex] ?? '').trim() : '',
      barcode: barcodeIndex >= 0 ? String(row[barcodeIndex] ?? '').trim() : '',
      is_weight_based:
        weightColumnIndex >= 0 ? normalizeWeightFlag(row[weightColumnIndex], '0') : '0',
    }));
};

const findImportFileInput = () =>
  Array.from(document.querySelectorAll('input[type="file"]')).find((input) =>
    String(input.getAttribute('accept') || '').includes('.xlsx')
  );

const WeightedImportAdapter = (props) => {
  const weightByKeyRef = useRef(new Map());
  const weightByIndexRef = useRef([]);
  const requestOffsetRef = useRef(0);

  useEffect(() => {
    const rememberRows = (rows) => {
      const byKey = new Map();
      const byIndex = [];
      rows.forEach((row, index) => {
        const flag = normalizeWeightFlag(row.is_weight_based, '0');
        byIndex[index] = flag;
        const key = rowKey(row);
        if (key !== '|') byKey.set(key, flag);
      });
      weightByKeyRef.current = byKey;
      weightByIndexRef.current = byIndex;
      requestOffsetRef.current = 0;
    };

    const onFileChange = async (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
      if (!String(input.getAttribute('accept') || '').includes('.xlsx')) return;
      const file = input.files?.[0];
      if (!file) {
        rememberRows([]);
        return;
      }
      try {
        rememberRows(await parseWeightRows(file));
      } catch (error) {
        console.error('[customer-fix] failed to parse weight column', error);
        rememberRows([]);
      }
    };

    document.addEventListener('change', onFileChange, true);

    const interceptorId = api.interceptors.request.use((config) => {
      const url = String(config?.url || '');
      if (!url.includes('/products/import-rows')) return config;
      const rows = Array.isArray(config?.data?.rows) ? config.data.rows : null;
      if (!rows) return config;

      const offset = requestOffsetRef.current;
      const patchedRows = rows.map((row, localIndex) => {
        const key = rowKey(row);
        const fromKey = weightByKeyRef.current.get(key);
        const fromIndex = weightByIndexRef.current[offset + localIndex];
        return {
          ...row,
          is_weight_based: normalizeWeightFlag(
            row?.is_weight_based ?? fromKey ?? fromIndex,
            '0'
          ),
        };
      });
      requestOffsetRef.current = offset + rows.length;
      return {
        ...config,
        data: {
          ...config.data,
          rows: patchedRows,
        },
      };
    });

    const ensureTypeColumn = () => {
      const table = document.querySelector('.import-preview-table table');
      if (!table) return;
      const headerRow = table.querySelector('thead tr');
      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
      if (!headerRow || bodyRows.length === 0) return;

      const headerCells = Array.from(headerRow.children);
      const existingTypeIndex = headerCells.findIndex((cell) =>
        /^type(\s*\(|$)/i.test(String(cell.textContent || '').trim())
      );
      let typeIndex = existingTypeIndex;

      if (typeIndex < 0) {
        const barcodeIndex = headerCells.findIndex((cell) =>
          String(cell.textContent || '').trim().toLowerCase() === 'barcode'
        );
        if (barcodeIndex < 0) return;
        const th = document.createElement('th');
        th.textContent = 'Type (Piece / Weight)';
        th.setAttribute('data-weight-import-adapter', 'true');
        headerRow.insertBefore(th, headerCells[barcodeIndex].nextSibling);
        typeIndex = barcodeIndex + 1;
      }

      bodyRows.forEach((tr, rowIndex) => {
        const cells = Array.from(tr.children);
        if (tr.querySelector('[data-weight-import-adapter="true"]')) return;
        if (cells[typeIndex] && cells[typeIndex].querySelector('select')) return;

        const td = document.createElement('td');
        td.setAttribute('data-weight-import-adapter', 'true');
        const select = document.createElement('select');
        select.className = 'form-select form-select-sm';
        select.setAttribute('aria-label', `Product type for import row ${rowIndex + 1}`);

        const pieceOption = document.createElement('option');
        pieceOption.value = '0';
        pieceOption.textContent = 'Piece-based';
        select.appendChild(pieceOption);

        const weightOption = document.createElement('option');
        weightOption.value = '1';
        weightOption.textContent = 'Weight-based';
        select.appendChild(weightOption);

        const current = normalizeWeightFlag(weightByIndexRef.current[rowIndex], '0');
        select.value = current;
        select.addEventListener('change', () => {
          const flag = normalizeWeightFlag(select.value, '0');
          weightByIndexRef.current[rowIndex] = flag;
          const latestCells = Array.from(tr.children);
          const nameInput = latestCells[1]?.querySelector('input');
          const barcodeInput = latestCells[4]?.querySelector('input');
          const key = rowKey({
            name: nameInput?.value || '',
            barcode: barcodeInput?.value || '',
          });
          if (key !== '|') weightByKeyRef.current.set(key, flag);
        });
        td.appendChild(select);
        tr.insertBefore(td, tr.children[typeIndex] || null);
      });
    };

    const observer = new MutationObserver(() => ensureTypeColumn());
    observer.observe(document.body, { childList: true, subtree: true });
    const intervalId = window.setInterval(ensureTypeColumn, 500);
    ensureTypeColumn();

    return () => {
      document.removeEventListener('change', onFileChange, true);
      api.interceptors.request.eject(interceptorId);
      observer.disconnect();
      window.clearInterval(intervalId);
    };
  }, []);

  return <ProductsPage {...props} />;
};

export default WeightedImportAdapter;
