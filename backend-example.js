/**
 * 后端API示例 - Node.js/Express
 * 
 * 这个文件展示了如何在后端处理Zalo token交换
 * 实际使用时，请将这段代码集成到您的后端项目中
 */

const express = require('express');
const fetch = require('node-fetch'); // 或使用axios
const cors = require('cors');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// Zalo配置（应该从环境变量读取）
const ZALO_CONFIG = {
    APP_ID: process.env.ZALO_APP_ID || 'YOUR_APP_ID',
    APP_SECRET: process.env.ZALO_APP_SECRET || 'YOUR_APP_SECRET'
};

/**
 * Token交换端点
 * POST /api/zalo/exchange-token
 * 
 * 请求体:
 * {
 *   "code": "授权码",
 *   "redirect_uri": "回调地址"
 * }
 * 
 * 响应:
 * {
 *   "access_token": "访问令牌",
 *   "expires_in": 3600,
 *   "refresh_token": "刷新令牌"
 * }
 */
app.post('/api/zalo/exchange-token', async (req, res) => {
    try {
        const { code, redirect_uri } = req.body;

        // 验证必要参数
        if (!code) {
            return res.status(400).json({
                error: 'missing_code',
                error_description: '缺少授权码(code)'
            });
        }

        // 构建Zalo token交换URL
        const tokenUrl = new URL('https://oauth.zalo.me/v4/oa/access_token');
        tokenUrl.searchParams.append('app_id', ZALO_CONFIG.APP_ID);
        tokenUrl.searchParams.append('app_secret', ZALO_CONFIG.APP_SECRET);
        tokenUrl.searchParams.append('code', code);

        // 调用Zalo API交换token
        const response = await fetch(tokenUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        // 检查是否有错误
        if (data.error) {
            console.error('Zalo token交换失败:', data);
            return res.status(400).json({
                error: data.error,
                error_description: data.error_description || 'Token交换失败'
            });
        }

        // 返回token信息
        res.json({
            access_token: data.access_token,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token || null
        });

    } catch (error) {
        console.error('Token交换异常:', error);
        res.status(500).json({
            error: 'internal_error',
            error_description: error.message || '服务器内部错误'
        });
    }
});

/**
 * 可选：刷新token端点
 * POST /api/zalo/refresh-token
 */
app.post('/api/zalo/refresh-token', async (req, res) => {
    try {
        const { refresh_token } = req.body;

        if (!refresh_token) {
            return res.status(400).json({
                error: 'missing_refresh_token',
                error_description: '缺少刷新令牌'
            });
        }

        const tokenUrl = new URL('https://oauth.zalo.me/v4/oa/access_token');
        tokenUrl.searchParams.append('app_id', ZALO_CONFIG.APP_ID);
        tokenUrl.searchParams.append('app_secret', ZALO_CONFIG.APP_SECRET);
        tokenUrl.searchParams.append('refresh_token', refresh_token);
        tokenUrl.searchParams.append('grant_type', 'refresh_token');

        const response = await fetch(tokenUrl.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.error) {
            return res.status(400).json({
                error: data.error,
                error_description: data.error_description || 'Token刷新失败'
            });
        }

        res.json({
            access_token: data.access_token,
            expires_in: data.expires_in,
            refresh_token: data.refresh_token || null
        });

    } catch (error) {
        console.error('Token刷新异常:', error);
        res.status(500).json({
            error: 'internal_error',
            error_description: error.message || '服务器内部错误'
        });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在端口 ${PORT}`);
    console.log(`Token交换端点: http://localhost:${PORT}/api/zalo/exchange-token`);
});

module.exports = app;

