/**
 * Zalo授权登录中间页
 * 功能：
 * 1. 处理Zalo OAuth 2.0授权流程
 * 2. 获取access_token和user_id
 * 3. 将数据传回Flutter-web项目
 * 4. 关闭中间页
 */

// Zalo OAuth配置 - 需要替换为实际的配置
const ZALO_CONFIG = {
    // Zalo App ID - 需要在Zalo开发者平台获取
    // appId: getUrlParameter('app_id') || '',
    appId: '548583800445969563',
    // Zalo App Secret - 用于服务器端交换token（如果需要在中间页直接处理，注意安全性）
    // appSecret: getUrlParameter('app_secret') || '',
    appSecret: 'y6kCG08P3t0UQ0S16eJK',
    // 授权回调地址 - 需要与Zalo开发者平台配置的回调地址一致
    // 自动使用当前页面的完整URL作为回调地址，支持子路径和根路径部署
    // redirectUri: getUrlParameter('redirect_uri') || window.location.origin + window.location.pathname,
    redirectUri: 'https://woshi49756916-crypto.github.io/zalo-redirct',
    // Zalo OAuth授权地址
    // authUrl: 'https://oauth.zalo.me/v4/oa/permission',
    authUrl: 'https://oauth.zaloapp.com/v4/permission',
    // Zalo Token交换地址（注意：需要使用POST方法）
    // tokenUrl: 'https://oauth.zalo.me/v4/oa/access_token',
    // tokenUrl: 'https://oauth.zaloapp.com/v4/access_token',
    tokenUrl: 'https://oauth.zaloapp.com/v4/oa/access_token',
    // Zalo用户信息获取地址
    userInfoUrl: 'https://graph.zalo.me/v2.0/me',
    // Flutter回调标识（通过URL参数传递）
    callbackScheme: getUrlParameter('callback_scheme') || 'flutterapp',
    // 是否使用postMessage方式（默认使用）
    usePostMessage: getUrlParameter('use_postmessage') !== 'false'
};

// 获取URL参数
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// 显示状态信息
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    const loadingEl = document.getElementById('loading');
    
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;
    loadingEl.classList.remove('hidden');
    
    if (type === 'error' || type === 'success') {
        loadingEl.classList.add('hidden');
    }
}

// 生成随机字符串（用于state参数）
function generateRandomString(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 存储state到sessionStorage
function saveState(state) {
    sessionStorage.setItem('zalo_oauth_state', state);
}

// 验证state
function verifyState(state) {
    const savedState = sessionStorage.getItem('zalo_oauth_state');
    sessionStorage.removeItem('zalo_oauth_state');
    return savedState === state;
}

// 跳转到Zalo授权页面
function redirectToZaloAuth() {
    if (!ZALO_CONFIG.appId) {
        showStatus('错误：缺少Zalo App ID配置', 'error');
        return;
    }

    const state = generateRandomString();
    saveState(state);

    // 构建Zalo授权URL
    const authParams = new URLSearchParams({
        app_id: ZALO_CONFIG.appId,
        redirect_uri: ZALO_CONFIG.redirectUri,
        state: state,
        // Zalo需要的权限范围
        scope: 'id,name,birthday,gender,picture'
    });

    const authUrl = `${ZALO_CONFIG.authUrl}?${authParams.toString()}`;
    
    showStatus('正在跳转到Zalo授权页面...', 'info');
    window.location.href = authUrl;
}

// 处理授权回调（从Zalo返回）
async function handleAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');

    // 检查是否有错误
    if (error) {
        showStatus(`授权失败：${error}`, 'error');
        setTimeout(() => {
            sendResultToFlutter({ error: error }, true);
        }, 2000);
        return;
    }

    // 验证state
    if (!state || !verifyState(state)) {
        showStatus('授权验证失败：state不匹配', 'error');
        setTimeout(() => {
            sendResultToFlutter({ error: 'state_verification_failed' }, true);
        }, 2000);
        return;
    }

    // 检查是否有授权码
    if (!code) {
        // 没有code，说明是首次访问，跳转到授权页面
        redirectToZaloAuth();
        return;
    }

    // 有code，交换access_token
    try {
        showStatus('正在获取访问令牌...', 'info');
        const tokenData = await exchangeCodeForToken(code);
        
        if (!tokenData || !tokenData.access_token) {
            throw new Error('无法获取access_token');
        }

        showStatus('正在获取用户信息...', 'info');
        const userInfo = await getUserInfo(tokenData.access_token);
        
        if (!userInfo || !userInfo.id) {
            throw new Error('无法获取用户信息');
        }

        // 准备返回数据
        const result = {
            access_token: tokenData.access_token,
            user_id: userInfo.id.toString(),
            expires_in: tokenData.expires_in,
            refresh_token: tokenData.refresh_token || null,
            user_info: {
                id: userInfo.id,
                name: userInfo.name,
                birthday: userInfo.birthday || null,
                gender: userInfo.gender || null,
                picture: userInfo.picture?.data?.url || null
            }
        };

        showStatus('授权成功！正在返回...', 'success');
        
        // 延迟一下让用户看到成功提示
        setTimeout(() => {
            sendResultToFlutter(result, false);
        }, 1000);

    } catch (error) {
        console.error('授权流程错误：', error);
        showStatus(`授权失败：${error.message}`, 'error');
        setTimeout(() => {
            sendResultToFlutter({ error: error.message }, true);
        }, 2000);
    }
}

// 使用授权码交换access_token
async function exchangeCodeForToken(code) {
    // 注意：Zalo的token交换需要在服务器端进行，因为需要app_secret
    // 这里提供两种方案：
    // 1. 如果中间页有自己的后端，通过后端API交换token
    // 2. 如果app_secret在前端（不推荐，安全性低），直接调用Zalo API
    
    const tokenExchangeUrl = getUrlParameter('token_exchange_url');
    
    if (tokenExchangeUrl) {
        // 方案1：通过后端API交换token（推荐）
        const response = await fetch(tokenExchangeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: code,
                redirect_uri: ZALO_CONFIG.redirectUri
            })
        });

        if (!response.ok) {
            throw new Error(`Token交换失败：${response.statusText}`);
        }

        return await response.json();
    } else if (ZALO_CONFIG.appSecret) {
        // 方案2：直接在前端调用（不推荐，仅用于测试）
        console.warn('警告：在前端直接使用app_secret是不安全的，仅用于测试环境');
        
        // Zalo API需要使用POST方法，Content-Type为application/x-www-form-urlencoded
        const tokenParams = new URLSearchParams({
            app_id: ZALO_CONFIG.appId,
            app_secret: ZALO_CONFIG.appSecret,
            code: code,
            grant_type: 'authorization_code'
        });

        const response = await fetch(ZALO_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: tokenParams.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token交换失败：${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error_description || data.error || 'Token交换失败');
        }

        return data;
    } else {
        throw new Error('缺少token交换配置，请提供token_exchange_url或app_secret');
    }
}

// 获取用户信息
async function getUserInfo(accessToken) {
    const response = await fetch(`${ZALO_CONFIG.userInfoUrl}?access_token=${accessToken}&fields=id,name,birthday,gender,picture`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        throw new Error(`获取用户信息失败：${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error_description || '获取用户信息失败');
    }

    return data;
}

// 将结果发送给Flutter-web项目
function sendResultToFlutter(result, isError) {
    if (ZALO_CONFIG.usePostMessage && window.opener) {
        // 方案1：使用postMessage（推荐，适用于window.open打开的窗口）
        try {
            window.opener.postMessage({
                type: 'zalo_auth_result',
                success: !isError,
                data: result,
                timestamp: Date.now()
            }, '*'); // 注意：生产环境应该指定具体的origin
            
            // 延迟关闭，确保消息已发送
            // setTimeout(() => {
            //     window.close();
            // }, 100);
        } catch (error) {
            console.error('postMessage失败，尝试使用URL方案：', error);
            fallbackToUrlScheme(result, isError);
        }
    } else {
        // 方案2：使用自定义URL Scheme（适用于WebView）
        fallbackToUrlScheme(result, isError);
    }
}

// 使用URL Scheme方案
function fallbackToUrlScheme(result, isError) {
    try {
        const params = new URLSearchParams();
        
        if (isError) {
            params.append('error', result.error || 'unknown_error');
        } else {
            params.append('access_token', result.access_token);
            params.append('user_id', result.user_id);
            if (result.expires_in) {
                params.append('expires_in', result.expires_in);
            }
        }

        const callbackUrl = `${ZALO_CONFIG.callbackScheme}://zalo_auth_callback?${params.toString()}`;
        
        // 尝试跳转到自定义scheme
        window.location.href = callbackUrl;
        
        // 如果无法打开自定义scheme，关闭窗口
        // setTimeout(() => {
        //     window.close();
        // }, 1000);
        
    } catch (error) {
        console.error('URL Scheme方案失败：', error);
        // 最后尝试直接关闭
        // window.close();
    }
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
    // 检查是否是授权回调
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (code || error) {
        // 有code或error，说明是Zalo回调
        handleAuthCallback();
    } else {
        // 首次访问，跳转到授权页面
        redirectToZaloAuth();
    }
});

// 监听来自Flutter的消息（可选，用于确认消息接收）
window.addEventListener('message', (event) => {
    // 处理来自zalo-redirct.html的回调消息
    if (event.data && event.data.type === 'zalo_auth_callback') {
        try {
            let code, state, error;
            
            // 优先使用直接传递的参数（更高效）
            if (event.data.code !== undefined || event.data.error !== undefined) {
                code = event.data.code;
                state = event.data.state;
                error = event.data.error;
            } 
            // 备用方案：从URL中解析参数
            else if (event.data.url) {
                const callbackUrl = new URL(event.data.url);
                code = callbackUrl.searchParams.get('code');
                state = callbackUrl.searchParams.get('state');
                error = callbackUrl.searchParams.get('error') || callbackUrl.searchParams.get('error_code');
            }
            
            // 如果有错误，显示错误信息
            if (error) {
                console.error('Zalo授权错误:', error);
                showStatus(`授权失败：${error}`, 'error');
                setTimeout(() => {
                    sendResultToFlutter({ error: error }, true);
                }, 2000);
                return;
            }
            
            // 如果有授权码，处理授权回调
            if (code) {
                console.log('收到Zalo授权码，开始处理...');
                handleAuthCallbackWithCode(code, state);
            } else {
                console.warn('收到回调消息但缺少授权码');
            }
        } catch (err) {
            console.error('处理Zalo回调消息失败:', err);
            showStatus('处理回调消息时发生错误', 'error');
        }
    }
    
    // 处理来自Flutter的确认消息
    if (event.data && event.data.type === 'zalo_auth_confirm') {
        console.log('Flutter已确认接收到授权结果');
        // window.close();
    }
});

// 使用授权码处理回调（从zalo-redirct.html接收）
async function handleAuthCallbackWithCode(code, state) {
    // 验证state
    if (!state || !verifyState(state)) {
        showStatus('授权验证失败：state不匹配', 'error');
        setTimeout(() => {
            sendResultToFlutter({ error: 'state_verification_failed' }, true);
        }, 2000);
        return;
    }

    // 交换access_token
    try {
        showStatus('正在获取访问令牌...', 'info');
        const tokenData = await exchangeCodeForToken(code);
        
        if (!tokenData || !tokenData.access_token) {
            throw new Error('无法获取access_token');
        }

        showStatus('正在获取用户信息...', 'info');
        const userInfo = await getUserInfo(tokenData.access_token);
        
        if (!userInfo || !userInfo.id) {
            throw new Error('无法获取用户信息');
        }

        // 准备返回数据
        const result = {
            access_token: tokenData.access_token,
            user_id: userInfo.id.toString(),
            expires_in: tokenData.expires_in,
            refresh_token: tokenData.refresh_token || null,
            user_info: {
                id: userInfo.id,
                name: userInfo.name,
                birthday: userInfo.birthday || null,
                gender: userInfo.gender || null,
                picture: userInfo.picture?.data?.url || null
            }
        };

        showStatus('授权成功！正在返回...', 'success');
        
        // 延迟一下让用户看到成功提示
        setTimeout(() => {
            sendResultToFlutter(result, false);
        }, 1000);

    } catch (error) {
        console.error('授权流程错误：', error);
        showStatus(`授权失败：${error.message}`, 'error');
        setTimeout(() => {
            sendResultToFlutter({ error: error.message }, true);
        }, 2000);
    }
}

