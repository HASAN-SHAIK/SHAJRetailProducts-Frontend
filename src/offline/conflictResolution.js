/**
 * Client-side sync metadata for conflict resolution.
 * Stamps version and last-modified fields onto records before queueing.
 */

export const extractSyncVersion = (record = {}) => {
  const raw =
    record.sync_version ??
    record.syncVersion ??
    record.version_number ??
    record.versionNumber ??
    record.version;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const extractLastModified = (record = {}) =>
  record.updated_at ||
  record.updatedAt ||
  record.last_modified ||
  record.lastModified ||
  record.created_at ||
  record.createdAt ||
  null;

export const stampSyncMetadata = (record = {}, { incrementVersion = true } = {}) => {
  const now = new Date().toISOString();
  const currentVersion = extractSyncVersion(record);
  const nextVersion = incrementVersion ? currentVersion + 1 : currentVersion;
  return {
    ...record,
    sync_version: nextVersion,
    syncVersion: nextVersion,
    version_number: nextVersion,
    updated_at: now,
    updatedAt: now,
    last_modified: now,
    lastModified: now,
  };
};

export const attachSyncMetadataToPayload = (payload = {}, record = {}) => {
  const stamped = stampSyncMetadata({ ...record, ...payload });
  return {
    ...payload,
    sync_version: stamped.sync_version,
    syncVersion: stamped.syncVersion,
    version_number: stamped.version_number,
    updated_at: stamped.updated_at,
    updatedAt: stamped.updatedAt,
    last_modified: stamped.last_modified,
    lastModified: stamped.lastModified,
  };
};

export const buildSyncOperationEnvelope = (operation = {}) => {
  const payload = attachSyncMetadataToPayload(operation.payload || operation);
  return {
    ...operation,
    payload,
    clientId:
      operation.clientId ||
      operation.client_id ||
      payload.client_id ||
      payload.client_order_id ||
      null,
  };
};
