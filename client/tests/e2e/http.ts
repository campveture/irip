// APIRequestContext is not a browser: explicitly model the trusted local origin.
export const apiHeaders = { 'X-IRIP-Request': '1', Origin: 'http://127.0.0.1:43139' };
