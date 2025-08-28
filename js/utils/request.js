// 统一请求封装：超时、重试（指数退避）、错误解析

export async function fetchJSON(
    url,
    {
        method = 'GET',
        headers,
        body,
        timeout = 10000,
        retries = 0,
        retryDelay = 500,
        backoff = 2,
        retryOn,
    } = {}
) {
    const shouldRetry = (attempt, error, response) => {
        if (typeof retryOn === 'function') {
            return retryOn({ attempt, error, response });
        }
        if (error) {
            // 网络错误/超时默认可重试
            return true;
        }
        if (!response) return false;
        // 429/5xx 默认重试
        return response.status === 429 || (response.status >= 500 && response.status < 600);
    };

    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const controller = new AbortController();
        const abortId = setTimeout(() => controller.abort(), timeout);
        let response;
        try {
            response = await fetch(url, {
                method,
                headers,
                body,
                signal: controller.signal,
            });
        } catch (err) {
            clearTimeout(abortId);
            if (attempt < retries && shouldRetry(attempt, err, null)) {
                const delay = retryDelay * Math.pow(backoff, attempt);
                await sleep(delay);
                attempt++;
                continue;
            }
            const error = new Error(err?.name === 'AbortError' ? '请求超时' : '网络错误');
            error.code = err?.name === 'AbortError' ? 'ABORT_ERROR' : 'NETWORK_ERROR';
            error.cause = err;
            error.url = url;
            throw error;
        } finally {
            clearTimeout(abortId);
        }

        let data;
        let parseError;
        const contentType = response.headers.get('content-type') || '';
        try {
            data = contentType.includes('application/json')
                ? await response.json()
                : await response.text();
        } catch (err) {
            parseError = err;
        }

        if (response.ok) {
            return data;
        }

        if (attempt < retries && shouldRetry(attempt, null, response)) {
            const delay = retryDelay * Math.pow(backoff, attempt);
            await sleep(delay);
            attempt++;
            continue;
        }

        const error = new Error(`HTTP ${response.status}`);
        error.code = 'HTTP_ERROR';
        error.status = response.status;
        error.url = url;
        error.body = typeof data === 'string' ? data.slice(0, 500) : data;
        if (parseError) error.parseError = parseError;
        throw error;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
