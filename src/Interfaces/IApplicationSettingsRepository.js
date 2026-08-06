/**
 * @typedef {object} IApplicationSettingsRepository
 * @property {() => Promise<object>} getApplicationSettings
 * @property {(payload: object) => Promise<object>} updateApplicationSettings
 * @property {(group: string) => Promise<object>} getSettingGroup
 * @property {(group: string, values: object) => Promise<object>} updateSettingGroup
 */

export {};
