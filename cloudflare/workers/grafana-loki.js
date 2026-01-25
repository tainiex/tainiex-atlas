export default {
    async fetch(request, env) {
        // 1. 设置允许的域名白名单
        const ALLOWED_ORIGINS = ['https://www.your-website.com', 'https://admin.your-website.com'];

        const origin = request.headers.get('Origin');

        // 2. 检查 Origin 是否在白名单内
        // 注意：如果是浏览器请求，Origin 无法伪造；如果是脚本，反正我们防不住，但至少防住了跨站调用
        if (!ALLOWED_ORIGINS.includes(origin)) {
            return new Response('Forbidden: Invalid Origin', { status: 403 });
        }

        // 3. 只有域名校验通过，才去请求 Loki
        // 将你的 Loki URL 和 Basic Auth 放在 Cloudflare 的环境变量里，不要写在代码里！
        const LOKI_URL = env.LOKI_URL;
        const LOKI_AUTH = env.LOKI_AUTH; // 你的 Base64 Key

        // 4. 转发请求
        const newRequest = new Request(LOKI_URL, {
            method: request.method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${LOKI_AUTH}`, // 在这里秘密注入 Key
                // 可以加上 Trace ID 等
            },
            body: request.body
        });

        const response = await fetch(newRequest);

        // 5. 返回 CORS 头，允许浏览器接收响应
        const newResponse = new Response(response.body, response);
        newResponse.headers.set('Access-Control-Allow-Origin', origin);

        return newResponse;
    }
};