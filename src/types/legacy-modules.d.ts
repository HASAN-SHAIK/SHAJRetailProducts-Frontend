declare module '../utils/axios' {
  const api: {
    get: (...args: any[]) => Promise<any>;
    post: (...args: any[]) => Promise<any>;
    put: (...args: any[]) => Promise<any>;
    delete: (...args: any[]) => Promise<any>;
  };

  export default api;
}
