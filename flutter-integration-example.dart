/**
 * Flutter-web集成示例
 * 
 * 这个文件展示了如何在Flutter-web项目中集成Zalo授权登录中间页
 * 请根据您的项目结构进行适配
 */

import 'dart:html' as html;
import 'dart:js' as js;

/// Zalo授权结果
class ZaloAuthResult {
  final bool success;
  final String? accessToken;
  final String? userId;
  final String? error;
  final Map<String, dynamic>? userInfo;

  ZaloAuthResult({
    required this.success,
    this.accessToken,
    this.userId,
    this.error,
    this.userInfo,
  });

  factory ZaloAuthResult.fromMap(Map<String, dynamic> data) {
    if (data['success'] == true) {
      final resultData = data['data'] as Map<String, dynamic>;
      return ZaloAuthResult(
        success: true,
        accessToken: resultData['access_token'] as String?,
        userId: resultData['user_id'] as String?,
        userInfo: resultData['user_info'] as Map<String, dynamic>?,
      );
    } else {
      final resultData = data['data'] as Map<String, dynamic>;
      return ZaloAuthResult(
        success: false,
        error: resultData['error'] as String?,
      );
    }
  }
}

/// Zalo授权服务类
class ZaloAuthService {
  // 中间页URL
  final String middlePageUrl;
  
  // Zalo App ID
  final String appId;
  
  // Token交换后端API地址（可选，如果中间页直接处理则不需要）
  final String? tokenExchangeUrl;
  
  // 回调Scheme（用于WebView方式）
  final String callbackScheme;

  ZaloAuthService({
    required this.middlePageUrl,
    required this.appId,
    this.tokenExchangeUrl,
    this.callbackScheme = 'yourapp',
  });

  /// 打开Zalo授权窗口（使用window.open方式，推荐）
  /// 
  /// 返回Future，成功时返回ZaloAuthResult，用户取消时返回null
  Future<ZaloAuthResult?> authorizeWithPopup() async {
    // 构建中间页URL
    final uri = Uri.parse(middlePageUrl).replace(
      queryParameters: {
        'app_id': appId,
        'redirect_uri': middlePageUrl,
        if (tokenExchangeUrl != null) 'token_exchange_url': tokenExchangeUrl!,
        'callback_scheme': callbackScheme,
        'use_postmessage': 'true',
      },
    );

    // 打开新窗口
    final popup = html.window.open(
      uri.toString(),
      'zalo_auth',
      'width=600,height=700,scrollbars=yes,resizable=yes,left=${(html.window.screen?.width ?? 800 - 300) ~/ 2},top=${(html.window.screen?.height ?? 600 - 350) ~/ 2}',
    );

    if (popup == null) {
      throw Exception('无法打开授权窗口，请检查浏览器弹窗设置');
    }

    // 创建Completer来等待授权结果
    final completer = Completer<ZaloAuthResult?>();
    
    // 监听postMessage
    StreamSubscription<html.MessageEvent>? subscription;
    subscription = html.window.onMessage.listen((event) {
      try {
        // 验证消息来源（生产环境应该验证origin）
        // if (event.origin != 'https://your-domain.com') return;
        
        final data = event.data;
        if (data is Map && data['type'] == 'zalo_auth_result') {
          final result = ZaloAuthResult.fromMap(data);
          
          // 取消监听
          subscription?.cancel();
          
          // 关闭弹窗
          popup.close();
          
          // 完成Future
          if (result.success) {
            completer.complete(result);
          } else {
            completer.completeError(Exception(result.error ?? '授权失败'));
          }
        }
      } catch (e) {
        subscription?.cancel();
        completer.completeError(e);
      }
    });

    // 监听窗口关闭（用户可能手动关闭）
    Timer? checkTimer;
    checkTimer = Timer.periodic(Duration(milliseconds: 500), (timer) {
      if (popup.closed == true) {
        timer.cancel();
        subscription?.cancel();
        if (!completer.isCompleted) {
          completer.complete(null); // 用户取消
        }
      }
    });

    return completer.future;
  }

  /// 使用WebView方式（需要在WebView中打开）
  /// 
  /// 这种方式适合在Flutter WebView中使用，通过URL Scheme回调
  String getAuthorizationUrl() {
    return Uri.parse(middlePageUrl).replace(
      queryParameters: {
        'app_id': appId,
        'redirect_uri': middlePageUrl,
        if (tokenExchangeUrl != null) 'token_exchange_url': tokenExchangeUrl!,
        'callback_scheme': callbackScheme,
        'use_postmessage': 'false',
      },
    ).toString();
  }
}

// 使用示例：

/*
// 1. 创建服务实例
final zaloAuth = ZaloAuthService(
  middlePageUrl: 'https://your-domain.com/zalo-h5-middle/index.html',
  appId: 'YOUR_ZALO_APP_ID',
  tokenExchangeUrl: 'https://your-backend.com/api/zalo/exchange-token',
);

// 2. 在按钮点击时调用
ElevatedButton(
  onPressed: () async {
    try {
      final result = await zaloAuth.authorizeWithPopup();
      
      if (result != null && result.success) {
        // 授权成功
        print('授权成功！');
        print('Access Token: ${result.accessToken}');
        print('User ID: ${result.userId}');
        
        // 保存token
        // 进行后续API调用等
        // Navigator.push(...) 或更新状态
      } else if (result == null) {
        // 用户取消了授权
        print('用户取消了授权');
      }
    } catch (e) {
      // 处理错误
      print('授权失败: $e');
      // 显示错误提示
    }
  },
  child: Text('使用Zalo登录'),
)

// 3. WebView方式示例
WebViewWidget(
  controller: WebViewController()
    ..setJavaScriptMode(JavaScriptMode.unrestricted)
    ..setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (NavigationRequest request) {
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
            }
            
            return NavigationDecision.prevent;
          }
          return NavigationDecision.navigate;
        },
      ),
    )
    ..loadRequest(Uri.parse(zaloAuth.getAuthorizationUrl())),
)
*/

