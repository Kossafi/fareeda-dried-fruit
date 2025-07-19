import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { config } from '../config';
import logger from '../utils/logger';

const createServiceProxy = (serviceName: string, serviceConfig: { url: string; timeout: number }): any => {
  const options: Options = {
    target: serviceConfig.url,
    changeOrigin: true,
    pathRewrite: {
      [`^/api/${serviceName}`]: '',
    },
    timeout: serviceConfig.timeout,
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}:`, err);
      if (res && !res.headersSent) {
        res.status(503).json({
          error: 'Service temporarily unavailable',
          service: serviceName,
        });
      }
    },
    onProxyReq: (proxyReq, req) => {
      logger.debug(`Proxying ${req.method} ${req.url} to ${serviceName}`);
      
      // Add request ID for tracing
      const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
      proxyReq.setHeader('X-Request-ID', requestId);
      
      // Forward user context
      if (req.headers.authorization) {
        proxyReq.setHeader('Authorization', req.headers.authorization);
      }
    },
    onProxyRes: (proxyRes, req) => {
      logger.debug(`Response from ${serviceName}: ${proxyRes.statusCode}`);
    },
  };

  return createProxyMiddleware(options);
};

export const authServiceProxy = createServiceProxy('auth', config.services.auth);
export const inventoryServiceProxy = createServiceProxy('inventory', config.services.inventory);
export const salesServiceProxy = createServiceProxy('sales', config.services.sales);
export const shippingServiceProxy = createServiceProxy('shipping', config.services.shipping);
export const notificationServiceProxy = createServiceProxy('notification', config.services.notification);
export const reportingServiceProxy = createServiceProxy('reporting', config.services.reporting);