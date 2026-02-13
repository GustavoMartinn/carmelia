export interface HttpRequestOptions {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  timeout: number
  followRedirects: boolean
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}

/**
 * Execute an HTTP request using native fetch (Node 18+)
 */
export async function executeRequest(options: HttpRequestOptions): Promise<HttpResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeout)

  const start = performance.now()

  try {
    const response = await fetch(options.url, {
      method: options.method,
      headers: options.headers,
      body: options.body,
      signal: controller.signal,
      redirect: options.followRedirects ? 'follow' : 'manual',
    })

    const responseBody = await response.text()
    const time = Math.round(performance.now() - start)

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })

    return {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      time,
      size: new TextEncoder().encode(responseBody).length,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${options.timeout}ms — ${options.method} ${options.url}`)
    }
    if (error instanceof TypeError && (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED'))) {
      throw new Error(`Connection refused — is the server running at ${options.url}?`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
