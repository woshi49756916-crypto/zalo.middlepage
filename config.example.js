/**
 * 配置文件示例
 * 
 * 复制此文件为 config.js 并填入您的实际配置
 * 注意：config.js 应该添加到 .gitignore 中，不要提交到版本控制
 */

const CONFIG = {
    // Zalo应用配置
    ZALO: {
        // Zalo App ID - 从Zalo开发者平台获取
        APP_ID: 'YOUR_ZALO_APP_ID',
        
        // Zalo App Secret - 从Zalo开发者平台获取（不要在前端使用！）
        APP_SECRET: 'YOUR_ZALO_APP_SECRET',
        
        // 授权回调地址 - 必须与Zalo开发者平台配置的一致
        REDIRECT_URI: 'https://your-domain.com/zalo-h5-middle/index.html',
        
        // Token交换后端API地址（推荐使用）
        TOKEN_EXCHANGE_URL: 'https://your-backend.com/api/zalo/exchange-token',
    },
    
    // Flutter回调配置
    FLUTTER: {
        // 自定义URL Scheme（用于WebView方式）
        CALLBACK_SCHEME: 'yourapp',
        
        // 是否使用postMessage（true）或URL Scheme（false）
        USE_POST_MESSAGE: true,
    }
};

// 如果是在浏览器环境中使用，可以通过URL参数覆盖
if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    CONFIG.ZALO.APP_ID = urlParams.get('app_id') || CONFIG.ZALO.APP_ID;
    CONFIG.FLUTTER.CALLBACK_SCHEME = urlParams.get('callback_scheme') || CONFIG.FLUTTER.CALLBACK_SCHEME;
}

