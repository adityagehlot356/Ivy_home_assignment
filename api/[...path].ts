/**
 * Serverless Reverse Proxy for Ivy Homes API
 *
 * Keeps IVY_API_KEY strictly server-side in production.
 * Forwards requests to https://solve.ivy.homes with:
 * - Server-side injected `X-API-Key: process.env.IVY_API_KEY`
 * - Forwarded `Authorization: Bearer <token>`
 * - Forwarded query parameters and request bodies
 */

import type { IncomingMessage, ServerResponse } from 'http';

interface VercelReq extends IncomingMessage {
  query?: Record<string, string | string[]>;
  body?: any;
  method?: string;
  url?: string;
}

interface VercelRes extends ServerResponse {
  status: (code: number) => VercelRes;
  json: (data: any) => void;
  send: (data: any) => void;
  setHeader: (name: string, value: string) => this;
}

const UPSTREAM_BASE_URL = process.env.IVY_BASE_URL || 'https://solve.ivy.homes';

export default async function handler(req: any, res?: any) {
  // 1. Support Edge Runtime if executed in an Edge environment
  if (typeof Request !== 'undefined' && req instanceof Request && !res) {
    return handleEdgeRequest(req);
  }

  // 2. Default Node.js Serverless Function Runtime on Vercel
  return handleNodeRequest(req, res);
}

async function handleNodeRequest(req: VercelReq, res: VercelRes) {
  try {
    const apiKey = process.env.IVY_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        detail: 'Server configuration error: IVY_API_KEY is not configured on the server.',
      });
      return;
    }

    // 1. Resolve path segments cleanly from req.query.path, Vercel headers, or fallback to req.url
    let pathSegments = '';
    
    if (req.query && req.query.path) {
      if (Array.isArray(req.query.path)) {
        pathSegments = req.query.path.join('/');
      } else if (typeof req.query.path === 'string') {
        pathSegments = req.query.path;
      }
    }

    // Defensive fallback: check Vercel's x-invoke-path header
    if (!pathSegments && req.headers && req.headers['x-invoke-path']) {
      const invokePath = Array.isArray(req.headers['x-invoke-path']) 
        ? req.headers['x-invoke-path'][0] 
        : req.headers['x-invoke-path'];
      pathSegments = invokePath.replace(/^\/api\/?/, '');
    }

    // Defensive fallback: If pathSegments is empty or literal bracket/proxy placeholder, parse req.url
    if (!pathSegments || pathSegments === '[...path]' || pathSegments === '[[...path]]' || pathSegments === 'proxy') {
      const rawUrl = req.url || '';
      const pathname = rawUrl.split('?')[0];
      pathSegments = pathname.replace(/^\/api\/?/, '');
      if (pathSegments === 'proxy') {
          // If we are literally at /api/proxy and have no path param, something is wrong, fallback to empty string
          pathSegments = '';
      }
    }

    // Sanitize any leading or trailing slashes
    const cleanPath = pathSegments.replace(/^\/+|\/+$/g, '');

    // 2. Resolve query parameters cleanly
    let queryString = '';
    if (req.url && req.url.includes('?')) {
      queryString = req.url.split('?')[1] || '';
    } else if (req.query) {
      const qp = new URLSearchParams();
      for (const [key, val] of Object.entries(req.query)) {
        if (key === 'path') continue;
        if (Array.isArray(val)) {
          val.forEach((v) => qp.append(key, v));
        } else if (val !== undefined) {
          qp.append(key, val);
        }
      }
      queryString = qp.toString();
    }

    const targetUrl = `${UPSTREAM_BASE_URL}/${cleanPath}${queryString ? `?${queryString}` : ''}`;

    // 3. Build headers to forward upstream
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };

    // Forward incoming client Authorization header
    if (req.headers && req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    const method = (req.method || 'GET').toUpperCase();
    let bodyData: string | undefined = undefined;

    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body: bodyData,
    });

    res.status(upstreamResponse.status);

    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    // Inject debug headers
    res.setHeader('X-Debug-Target-Url', targetUrl);
    res.setHeader('X-Debug-Clean-Path', cleanPath);
    res.setHeader('X-Debug-Req-Url', req.url || 'none');
    res.setHeader('X-Debug-Req-Query-Path', JSON.stringify(req.query?.path || 'none'));

    const textData = await upstreamResponse.text();
    res.send(textData);
  } catch (error: any) {
    res.status(502).json({
      detail: 'Failed to communicate with upstream Ivy Homes API',
      error: error?.message || String(error),
    });
  }
}

async function handleEdgeRequest(req: Request): Promise<Response> {
  try {
    const apiKey = process.env.IVY_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ detail: 'Server configuration error: IVY_API_KEY is not set.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const incomingUrl = new URL(req.url);
    
    let targetPath = incomingUrl.searchParams.get('path') || '';
    
    if (!targetPath && req.headers.has('x-invoke-path')) {
      targetPath = req.headers.get('x-invoke-path')!.replace(/^\/api\/?/, '');
    }

    if (!targetPath || targetPath === '[...path]' || targetPath === '[[...path]]' || targetPath === 'proxy') {
      targetPath = incomingUrl.pathname.replace(/^\/api\/?/, '');
      if (targetPath === 'proxy') targetPath = '';
    }

    const cleanPath = targetPath.replace(/^\/+|\/+$/g, '');
    
    // Remove the synthetic path query parameter before forwarding
    incomingUrl.searchParams.delete('path');
    const searchString = incomingUrl.search;
    
    const targetUrl = `${UPSTREAM_BASE_URL}/${cleanPath}${searchString}`;

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('X-API-Key', apiKey);

    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }

    const method = req.method.toUpperCase();
    const body = method !== 'GET' && method !== 'HEAD' ? await req.text() : undefined;

    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    const responseHeaders = new Headers();
    const contentType = upstreamResponse.headers.get('content-type');
    if (contentType) {
      responseHeaders.set('Content-Type', contentType);
    }

    return new Response(await upstreamResponse.text(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({
        detail: 'Failed to communicate with upstream Ivy Homes API',
        error: error?.message || String(error),
      }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
