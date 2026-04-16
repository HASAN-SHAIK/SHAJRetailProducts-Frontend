import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './SupportPage.css';
import api from '../../utils/axios';
import { useSelector } from 'react-redux';
import { usePopup } from '../common/PopUp/PopupProvider';
import { hasFeature, isPlanAtLeast } from '../../utils/entitlements';

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Urgent', value: 'urgent' },
];

const SupportPage = ({ navigate }) => {
  const tenantConfig = useSelector((state) => state.tenant.tenantConfig);
  const prioritySupportEnabled = hasFeature(tenantConfig, 'priority_support');
  const proOrPremiumEnabled = isPlanAtLeast(tenantConfig, 'pro');
  const { showPopup } = usePopup();

  const [cases, setCases] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total_pages: 1,
    total_records: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    category: '',
    description: '',
    priority: 'medium',
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [drawerCase, setDrawerCase] = useState(null);
  const [drawerMessages, setDrawerMessages] = useState([]);
  const [drawerRefreshing, setDrawerRefreshing] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

  const formatDate = useCallback((value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, []);

  const buildParams = useCallback(() => ({
    page: pagination.page,
    limit: pagination.limit,
    search: searchQuery || undefined,
    status: statusFilter || undefined,
  }), [pagination.page, pagination.limit, searchQuery, statusFilter]);

  const fetchCases = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.get('/support/cases', { params: buildParams() });
      const payload = res?.data?.data || res?.data || {};
      const list = Array.isArray(payload.cases) ? payload.cases : Array.isArray(payload.data) ? payload.data : [];
      setCases(list);
      setPagination((prev) => ({
        ...prev,
        page: payload.pagination?.page || prev.page,
        limit: payload.pagination?.limit || prev.limit,
        total_pages: payload.pagination?.total_pages || 1,
        total_records: payload.pagination?.total_records || 0,
      }));
    } catch (err) {
      if (err.response?.data?.message === 'Invalid Token' || err.response?.status === 401) {
        showPopup('Token Expired Please Login Again!', 'Session');
        navigate('/logout');
        return;
      }
      setErrorMessage('Unable to load support cases. Please try again.');
      setCases([]);
    } finally {
      setIsLoading(false);
    }
  }, [buildParams, navigate, showPopup]);

  const handleRefreshCases = async () => {
    setRefreshing(true);
    await fetchCases();
    setRefreshing(false);
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/support/category');
      const payload = res?.data?.data || res?.data || [];
      const list = Array.isArray(payload) ? payload : payload?.categories || [];
      setCategories(list);
    } catch (err) {
      // Non-blocking
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    fetchCases();
    fetchCategories();
  }, [fetchCases, fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination((prev) => ({ ...prev, page: 1 }));
      setSearchQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const openCreate = () => {
    setCreateOpen(true);
  };

  const closeCreate = () => {
    setCreateOpen(false);
    setCreateForm({
      title: '',
      category: '',
      description: '',
      priority: 'medium',
    });
  };

  const handleCreateSubmit = async (event) => {
    event.preventDefault();
    if (!createForm.title.trim()) {
      showPopup('Title is required.', 'Validation');
      return;
    }
    if (createForm.priority === 'high' && !proOrPremiumEnabled) {
      showPopup('High priority is available on Pro or Premium plans.', 'Feature');
      return;
    }
    if (createForm.priority === 'urgent' && !prioritySupportEnabled) {
      showPopup('Urgent priority is available on premium support.', 'Feature');
      return;
    }
    try {
      setCreateSubmitting(true);
      await api.post('/support/cases', createForm);
      showPopup('Support case created.', 'Success');
      closeCreate();
      fetchCases();
    } catch (err) {
      showPopup('Failed to create support case.', 'Error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openDrawer = async (caseId) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setDrawerError('');
    setDrawerCase(null);
    setDrawerMessages([]);
    try {
      const res = await api.get(`/support/cases/${caseId}`);
      const payload = res?.data?.data || res?.data || {};
      const caseDetails = payload.case || payload;
      const messages = payload.messages || caseDetails?.messages || caseDetails?.conversation || [];
      setDrawerCase(caseDetails);
      setDrawerMessages(Array.isArray(messages) ? messages : []);
    } catch (err) {
      setDrawerError('Unable to load case details.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const refreshDrawer = async () => {
    if (!drawerCase?.id) return;
    setDrawerRefreshing(true);
    await openDrawer(drawerCase.id);
    setDrawerRefreshing(false);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setDrawerCase(null);
    setDrawerError('');
    setReplyText('');
    setDrawerMessages([]);
  };

  const handleReplySubmit = async () => {
    if (!drawerCase?.id || !replyText.trim()) return;
    try {
      setReplySubmitting(true);
      await api.post(`/support/cases/${drawerCase.id}/messages`, {
        message: replyText.trim(),
      });
      setReplyText('');
      await openDrawer(drawerCase.id);
      fetchCases();
    } catch (err) {
      showPopup('Failed to send reply.', 'Error');
    } finally {
      setReplySubmitting(false);
    }
  };

  const pages = useMemo(() => {
    const total = pagination.total_pages || 1;
    return Array.from({ length: total }, (_, idx) => idx + 1);
  }, [pagination.total_pages]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'open':
        return 'badge-open';
      case 'in_progress':
        return 'badge-progress';
      case 'resolved':
        return 'badge-resolved';
      case 'closed':
        return 'badge-closed';
      default:
        return 'badge-open';
    }
  };

  return (
    <div className="support-page">
      <div className="support-header">
        <div>
          <h3>Support Cases</h3>
          <p>Track and manage your support requests.</p>
        </div>
        <div className="support-header-actions">
          <button
            className="btn btn-outline-primary"
            onClick={handleRefreshCases}
            disabled={isLoading || refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            Create Case
          </button>
        </div>
      </div>

      <div className="support-controls">
        <input
          className="form-control search-input"
          placeholder="Search cases"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <select
          className="form-select status-select"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="support-card">
        <div className="support-table-wrapper">
          <table className="support-table">
            <thead>
              <tr>
                <th>Case ID</th>
                <th>Title</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created Date</th>
                <th>Updated Date</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="skeleton-row">
                  {Array.from({ length: 7 }).map((__, cellIdx) => (
                    <td key={`cell-${cellIdx}`}><span className="skeleton-block" /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && errorMessage && (
                <tr>
                  <td colSpan={7} className="empty-state">{errorMessage}</td>
                </tr>
              )}
              {!isLoading && !errorMessage && cases.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">No support cases found.</td>
                </tr>
              )}
              {!isLoading && !errorMessage && cases.map((item) => (
                <tr
                  key={item.id}
                  className="support-row"
                  onClick={() => openDrawer(item.id)}
                  role="button"
                  tabIndex={0}
                >
                  <td>#{item.id}</td>
                  <td>{item.title || '-'}</td>
                  <td>{item.category || '-'}</td>
                  <td className={`priority-${item.priority || 'low'}`}>
                    {item.priority || '-'}
                  </td>
                  <td>
                    <span className={`status-badge ${getStatusClass(item.status)}`}>
                      {item.status || 'open'}
                    </span>
                  </td>
                  <td>{formatDate(item.created_at)}</td>
                  <td>{formatDate(item.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="support-pagination">
          <button
            className="page-btn"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
          >
            Prev
          </button>
          <div className="page-list">
            {pages.map((page) => (
              <button
                key={`page-${page}`}
                className={`page-btn ${page === pagination.page ? 'active' : ''}`}
                onClick={() => setPagination((prev) => ({ ...prev, page }))}
              >
                {page}
              </button>
            ))}
          </div>
          <button
            className="page-btn"
            disabled={pagination.page >= pagination.total_pages}
            onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
          >
            Next
          </button>
        </div>
      </div>

      {createOpen && (
        <div className="support-modal-overlay" onClick={closeCreate}>
          <div className="support-modal" onClick={(event) => event.stopPropagation()}>
            <h4>Create Support Case</h4>
            <form onSubmit={handleCreateSubmit}>
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input
                  className="form-control"
                  value={createForm.title}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={createForm.category}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
                >
                  <option value="">Select category</option>
                  {categories.map((cat, idx) => (
                    <option key={`cat-${idx}`} value={cat?.name || cat?.category || cat}>
                      {cat?.name || cat?.category || cat}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={createForm.description}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  value={createForm.priority}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, priority: event.target.value }))}
                >
                  {PRIORITY_OPTIONS.map((option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      disabled={
                        (option.value === 'high' && !proOrPremiumEnabled) ||
                        (option.value === 'urgent' && !prioritySupportEnabled)
                      }
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                {!proOrPremiumEnabled && (
                  <small className="form-text text-warning">
                    High priority is available on Pro or Premium plans.
                  </small>
                )}
                {!prioritySupportEnabled && (
                  <small className="form-text text-warning">
                    Urgent priority is available with priority support.
                  </small>
                )}
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline-secondary" onClick={closeCreate} disabled={createSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={createSubmitting}>
                  {createSubmitting ? 'Submitting...' : 'Create Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {drawerOpen && (
        <div className="support-drawer-overlay" onClick={closeDrawer}>
          <aside className="support-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">Case #{drawerCase?.id || '-'}</p>
                <h3 className="drawer-title">{drawerCase?.title || 'Support Case'}</h3>
              </div>
              <div className="drawer-actions">
                <button
                  className="btn btn-outline-primary btn-sm"
                  onClick={refreshDrawer}
                  disabled={drawerRefreshing || drawerLoading}
                  type="button"
                >
                  {drawerRefreshing ? 'Refreshing...' : 'Refresh'}
                </button>
                <button className="drawer-close" onClick={closeDrawer} type="button">Close</button>
              </div>
            </div>

            {drawerLoading && (
              <div className="drawer-loading">
                <span className="skeleton-block large" />
                <span className="skeleton-block" />
                <span className="skeleton-block" />
              </div>
            )}

            {!drawerLoading && drawerError && (
              <div className="drawer-empty">{drawerError}</div>
            )}

            {!drawerLoading && !drawerError && drawerCase && (
              <div className="drawer-content">
                <section className="drawer-section">
                  <h4>Case Details</h4>
                  <div className="drawer-grid">
                    <div>
                      <span className="label">Category</span>
                      <p>{drawerCase.category || '-'}</p>
                    </div>
                    <div>
                      <span className="label">Priority</span>
                      <p className={`priority-${drawerCase.priority || 'low'}`}>
                        {drawerCase.priority || '-'}
                      </p>
                    </div>
                    <div>
                      <span className="label">Status</span>
                      <span className={`status-badge ${getStatusClass(drawerCase.status)}`}>
                        {drawerCase.status || 'open'}
                      </span>
                    </div>
                    <div>
                      <span className="label">Created</span>
                      <p>{formatDate(drawerCase.created_at)}</p>
                    </div>
                    <div>
                      <span className="label">Updated</span>
                      <p>{formatDate(drawerCase.updated_at)}</p>
                    </div>
                  </div>
                </section>

                <section className="drawer-section">
                  <h4>Conversation</h4>
                  <div className="conversation-thread">
                    {drawerMessages.length === 0 && (
                      <div className="empty-state">No messages yet.</div>
                    )}
                    {drawerMessages.map((msg, idx) => (
                      <div key={`msg-${idx}`} className="message-card">
                        <div className="message-meta">
                          <span>{msg.sender_type || msg.sender || msg.author || 'Support'}</span>
                          <span>{formatDate(msg.created_at)}</span>
                        </div>
                        <p>{msg.message || msg.text || msg.body}</p>
                      </div>
                    ))}
                  </div>
                  <div className="reply-box">
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="Write a reply..."
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={handleReplySubmit}
                      disabled={replySubmitting || !replyText.trim()}
                    >
                      {replySubmitting ? 'Sending...' : 'Send Reply'}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
};

export default SupportPage;
