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

    // Determine path segments and query parameters
    let pathSegments = '';
    const queryParams = new URLSearchParams();

    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (key === 'path') {
          pathSegments = Array.isArray(value) ? value.join('/') : value;
        } else if (Array.isArray(value)) {
          for (const v of value) queryParams.append(key, v);
        } else if (value !== undefined) {
          queryParams.append(key, value);
        }
      }
    }

    // Fallback path parsing from req.url
    if (!pathSegments && req.url) {
      const parsedUrl = new URL(req.url, 'http://localhost');
      pathSegments = parsedUrl.pathname.replace(/^\/api\/?/, '');
      if (!req.query) {
        parsedUrl.searchParams.forEach((val, key) => queryParams.append(key, val));
      }
    }

    const queryString = queryParams.toString();
    const cleanPath = pathSegments.startsWith('/') ? pathSegments.slice(1) : pathSegments;
    const targetUrl = `${UPSTREAM_BASE_URL}/${cleanPath}${queryString ? `?${queryString}` : ''}`;

    // Build headers to forward upstream
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
    const targetPath = incomingUrl.pathname.replace(/^\/api\/?/, '');
    const targetUrl = `${UPSTREAM_BASE_URL}/${targetPath}${incomingUrl.search}`;

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
