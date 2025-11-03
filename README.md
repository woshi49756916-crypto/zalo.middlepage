# Zalo H5授权登录中间页

这是一个用于Flutter-web项目的Zalo授权登录中间页。用户点击Zalo登录按钮后，会跳转到此中间页完成授权，授权成功后会将`access_token`和`user_id`传回Flutter-web项目并自动关闭窗口。

## 功能特性

- ✅ 完整的Zalo OAuth 2.0授权流程
- ✅ 自动获取access_token和user_id
- ✅ 支持postMessage和URL Scheme两种方式传回数据
- ✅ 友好的用户界面和加载状态
- ✅ 错误处理和状态验证
- ✅ 响应式设计，支持移动端

## 使用方式

### 1. 配置Zalo应用

首先需要在[Zalo开发者平台](https://developers.zalo.me/)创建应用并获取：
- App ID
- App Secret
- 配置回调地址（Redirect URI）

### 2. 部署中间页

将项目文件部署到服务器（可以使用任何静态文件服务器）。

### 3. 在Flutter-web项目中调用

#### 方式1：使用window.open（推荐，使用postMessage）

```dart
// Flutter-web代码示例
import 'dart:html' as html;

void openZaloAuth() async {
  // 构建中间页URL，传入必要的参数
  final url = Uri.parse('https://your-domain.com/zalo-h5-middle/index.html').replace(
    queryParameters: {
      'app_id': 'YOUR_ZALO_APP_ID',
      'redirect_uri': 'https://your-domain.com/zalo-h5-middle/index.html',
      'token_exchange_url': 'https://your-backend.com/api/zalo/exchange-token', // 后端API地址
      'use_postmessage': 'true', // 使用postMessage方式
    },
  ).toString();

  // 打开新窗口
  final window = html.window.open(
    url,
    'zalo_auth',
    'width=600,height=700,scrollbars=yes,resizable=yes',
  );

  // 监听postMessage
  html.window.addEventListener('message', (event) {
    if (event.data is Map && event.data['type'] == 'zalo_auth_result') {
      final result = event.data;
      
      if (result['success'] == true) {
        final data = result['data'];
        final accessToken = data['access_token'];
        final userId = data['user_id'];
        
        // 处理授权成功的逻辑
        print('授权成功！');
        print('Access Token: $accessToken');
        print('User ID: $userId');
        
        // 保存token，进行后续API调用等
        // ...
      } else {
        // 处理授权失败
        print('授权失败: ${data['error']}');
      }
      
      // 关闭窗口（如果需要）
      window?.close();
    }
  });
}
```

#### 方式2：使用WebView（使用URL Scheme）

```dart
import 'package:webview_flutter/webview_flutter.dart';

class ZaloAuthWebView extends StatefulWidget {
  @override
  _ZaloAuthWebViewState createState() => _ZaloAuthWebViewState();
}

class _ZaloAuthWebViewState extends State<ZaloAuthWebView> {
  late WebViewController controller;

  @override
  void initState() {
    super.initState();
    
    final url = Uri.parse('https://your-domain.com/zalo-h5-middle/index.html').replace(
      queryParameters: {
        'app_id': 'YOUR_ZALO_APP_ID',
        'redirect_uri': 'https://your-domain.com/zalo-h5-middle/index.html',
        'token_exchange_url': 'https://your-backend.com/api/zalo/exchange-token',
        'callback_scheme': 'yourapp', // 自定义scheme
        'use_postmessage': 'false', // 不使用postMessage
      },
    ).toString();

    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (NavigationRequest request) {
            // 拦截回调URL
            if (request.url.startsWith('yourapp://zalo_auth_callback')) {
              final uri = Uri.parse(request.url);
              final accessToken = uri.queryParameters['access_token'];
              final userId = uri.queryParameters['user_id'];
              
              if (accessToken != null && userId != null) {
                // 处理授权成功
                Navigator.pop(context, {
                  'access_token': accessToken,
                  'user_id': userId,
                });
              } else if (uri.queryParameters['error'] != null) {
                // 处理授权失败
                Navigator.pop(context, {
                  'error': uri.queryParameters['error'],
                });
              }
              
              return NavigationDecision.prevent;
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(url));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Zalo授权')),
      body: WebViewWidget(controller: controller),
    );
  }
}
```

## URL参数说明

| 参数名 | 必填 | 说明 |
|--------|------|------|
| `app_id` | 是 | Zalo应用的App ID |
| `redirect_uri` | 否 | 授权回调地址，默认使用当前页面地址 |
| `token_exchange_url` | 是* | 后端API地址，用于交换token（推荐） |
| `app_secret` | 是* | Zalo应用的App Secret（不推荐在前端使用，仅用于测试） |
| `callback_scheme` | 否 | 自定义URL Scheme，默认'flutterapp' |
| `use_postmessage` | 否 | 是否使用postMessage，默认'true' |

> * 注意：`token_exchange_url`和`app_secret`至少提供一个。**强烈推荐使用`token_exchange_url`**，因为在前端直接使用`app_secret`存在安全风险。

## 后端API示例（Token交换）

中间页会向您的后端发送POST请求来交换token：

**请求：**
```json
POST /api/zalo/exchange-token
Content-Type: application/json

{
  "code": "授权码",
  "redirect_uri": "回调地址"
}
```

**响应：**
```json
{
  "access_token": "访问令牌",
  "expires_in": 3600,
  "refresh_token": "刷新令牌（可选）"
}
```

### Node.js示例

```javascript
app.post('/api/zalo/exchange-token', async (req, res) => {
  const { code, redirect_uri } = req.body;
  
  try {
    const response = await fetch(
      `https://oauth.zalo.me/v4/oa/access_token?app_id=${APP_ID}&app_secret=${APP_SECRET}&code=${code}`,
      { method: 'GET' }
    );
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Python示例

```python
from flask import Flask, request, jsonify
import requests

@app.route('/api/zalo/exchange-token', methods=['POST'])
def exchange_token():
    code = request.json.get('code')
    
    url = f'https://oauth.zalo.me/v4/oa/access_token'
    params = {
        'app_id': APP_ID,
        'app_secret': APP_SECRET,
        'code': code
    }
    
    response = requests.get(url, params=params)
    return jsonify(response.json())
```

## 返回数据格式

### 成功响应（postMessage）

```javascript
{
  type: 'zalo_auth_result',
  success: true,
  data: {
    access_token: '访问令牌',
    user_id: '用户ID',
    expires_in: 3600,
    refresh_token: '刷新令牌（可选）',
    user_info: {
      id: '用户ID',
      name: '用户名称',
      birthday: '生日',
      gender: '性别',
      picture: '头像URL'
    }
  },
  timestamp: 1234567890
}
```

### 失败响应

```javascript
{
  type: 'zalo_auth_result',
  success: false,
  data: {
    error: '错误信息'
  },
  timestamp: 1234567890
}
```

## 安全建议

1. **不要在前端使用App Secret**：推荐使用后端API来交换token
2. **验证回调URL**：确保回调URL与Zalo开发者平台配置的一致
3. **使用HTTPS**：在生产环境必须使用HTTPS
4. **验证state参数**：项目已实现state验证，防止CSRF攻击
5. **限制postMessage的origin**：在生产环境中，应该指定具体的origin而不是使用`*`

## 本地开发

```bash
# 安装依赖（可选）
npm install

# 启动本地服务器
npm run dev
# 或
npx http-server . -p 8080

# 访问 http://localhost:8080
```

## 常见问题

### 1. 授权后窗口无法自动关闭

- 检查浏览器是否阻止了弹出窗口
- 确保中间页是通过`window.open`打开的
- 尝试手动添加关闭按钮

### 2. postMessage无法接收

- 检查Flutter-web是否正确监听了`message`事件
- 确认中间页URL的origin与Flutter-web页面一致（或允许跨域）

### 3. Token交换失败

- 确认App ID和App Secret正确
- 检查后端API是否正常工作
- 查看浏览器控制台的错误信息

## 许可证

MIT License

## 参考文档

- [Zalo开发者文档](https://developers.zalo.me/)
- [OAuth 2.0规范](https://oauth.net/2/)

