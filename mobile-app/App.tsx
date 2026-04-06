import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import WebView, { type WebViewNavigation } from "react-native-webview";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DEFAULT_BASE_URL = "https://futurosemcontexto.vercel.app";
const DEFAULT_HOST = new URL(DEFAULT_BASE_URL).host;

function isLikelyOfflineError(message: string) {
  const normalized = String(message || "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes("internet") ||
    normalized.includes("offline") ||
    normalized.includes("network") ||
    normalized.includes("net::err") ||
    normalized.includes("dns") ||
    normalized.includes("connection") ||
    normalized.includes("host lookup") ||
    normalized.includes("timed out") ||
    normalized.includes("nao foi possivel")
  );
}

function normalizePath(path: string) {
  if (!path) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function pathFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return normalizePath(parsed.pathname + parsed.search);
  } catch {
    return "/";
  }
}

function normalizeNavigationTarget(value?: string | null) {
  if (!value) return "/";
  if (/^https?:\/\//i.test(value)) {
    return pathFromUrl(value);
  }

  return normalizePath(value);
}

function absoluteUrlFromPath(path: string) {
  return `${DEFAULT_BASE_URL}${normalizePath(path)}`;
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const hasLoadedOnceRef = useRef(false);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const lastCanGoBackRef = useRef(false);

  const [sourceUrl, setSourceUrl] = useState(DEFAULT_BASE_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showStartupLoading, setShowStartupLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [lastHttpStatus, setLastHttpStatus] = useState<number | null>(null);

  const navigateToPath = useCallback((path: string) => {
    const targetUrl = absoluteUrlFromPath(path);

    if (webRef.current && hasLoadedOnceRef.current) {
      const escapedUrl = JSON.stringify(targetUrl);
      webRef.current.injectJavaScript(`(function(){window.location.href=${escapedUrl};})();true;`);
      return;
    }

    setSourceUrl(targetUrl);
  }, []);

  const syncPushTokenWithWebsite = useCallback(() => {
    if (!pushToken || !webRef.current || !hasLoadedOnceRef.current) return;
    if (lastSyncedTokenRef.current === pushToken) return;

    const payload = JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
      deviceName: Device.deviceName || "",
    });

    const escapedPayload = JSON.stringify(payload);
    const script = `(function(){try{var payload=${escapedPayload};var send=function(){fetch('/api/mobile/push/register',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:payload});};if('requestIdleCallback'in window){requestIdleCallback(send,{timeout:1200});}else{setTimeout(send,0);}}catch(e){}true;})();`;
    webRef.current.injectJavaScript(script);
    lastSyncedTokenRef.current = pushToken;
  }, [pushToken]);

  useEffect(() => {
    const onBackPress = () => {
      if (!canGoBack) return false;
      webRef.current?.goBack();
      return true;
    };

    if (Platform.OS === "android") {
      const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => sub.remove();
    }

    return undefined;
  }, [canGoBack]);

  useEffect(() => {
    let alive = true;

    const openNotificationLink = (rawLink: unknown) => {
      const link = typeof rawLink === "string" ? rawLink : "";
      if (!link) return;
      navigateToPath(normalizeNavigationTarget(link));
    };

    Notifications.getLastNotificationResponseAsync()
      .then((event) => {
        if (!alive || !event) return;
        openNotificationLink(event.notification.request.content.data?.link);
      })
      .catch(() => {
        // ignore startup notification issues
      });

    const responseSub = Notifications.addNotificationResponseReceivedListener((event) => {
      openNotificationLink(event.notification.request.content.data?.link);
    });

    return () => {
      alive = false;
      responseSub.remove();
    };
  }, [navigateToPath]);

  useEffect(() => {
    if (!hasLoadedOnceRef.current) return;
    let alive = true;

    async function setupPush() {
      if (!Device.isDevice) return;

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "Notificacoes",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 200, 250],
          lightColor: "#ff2a97",
        });
      }

      const current = await Notifications.getPermissionsAsync();
      let status = current.status;
      if (status !== "granted") {
        const asked = await Notifications.requestPermissionsAsync();
        status = asked.status;
      }

      if (status !== "granted") return;

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId;

      const tokenResult = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      if (!alive) return;
      setPushToken(tokenResult.data);
    }

    const timer = setTimeout(() => {
      setupPush().catch(() => {
        // silent fail
      });
    }, 900);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [showStartupLoading]);

  useEffect(() => {
    if (!pushToken) return;
    const timer = setTimeout(() => {
      syncPushTokenWithWebsite();
    }, 700);

    return () => clearTimeout(timer);
  }, [pushToken, syncPushTokenWithWebsite]);

  const handleNavigation = (state: WebViewNavigation) => {
    if (state.canGoBack !== lastCanGoBackRef.current) {
      lastCanGoBackRef.current = state.canGoBack;
      setCanGoBack(state.canGoBack);
    }
  };

  const handleShouldStart = useCallback((request: { url: string }) => {
    const target = String(request.url || "").trim();
    if (!target) return false;
    if (
      target.startsWith("about:blank") ||
      target.startsWith("javascript:") ||
      target.startsWith("data:")
    ) {
      return true;
    }

    try {
      const parsed = new URL(target);
      const isTrustedHost = parsed.host === DEFAULT_HOST;
      if (!isTrustedHost) {
        Linking.openURL(target).catch(() => {
          // ignore
        });
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleWebProcessCrash = useCallback(() => {
    setLoadError("O player foi reiniciado para manter a estabilidade.");
    setTimeout(() => {
      setLoadError(null);
      webRef.current?.reload();
    }, 300);
  }, []);

  const retryWebView = useCallback(() => {
    setLoadError(null);
    setLastHttpStatus(null);
    setShowStartupLoading(true);
    hasLoadedOnceRef.current = false;
    webRef.current?.reload();
  }, []);

  const handleExitApp = useCallback(() => {
    if (Platform.OS === "android") {
      BackHandler.exitApp();
      return;
    }

    setLoadError(null);
  }, []);

  const isOfflineError = isLikelyOfflineError(loadError || "");
  const errorTitle = isOfflineError ? "Sem conexão com a internet" : "Erro ao carregar";
  const errorDescription = isOfflineError
    ? "Por favor, verifique sua conexão com a internet e tente novamente."
    : loadError || "Não foi possível carregar o app no momento.";
  const showErrorOverlay = Boolean(loadError);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <WebView
        ref={webRef}
        source={{ uri: sourceUrl }}
        startInLoadingState
        renderLoading={() => <View />}
        renderError={() => <View style={styles.webFallback} />}
        onLoadStart={() => {
          setLoadError(null);
          setLastHttpStatus(null);
          if (!hasLoadedOnceRef.current) {
            setShowStartupLoading(true);
          }
        }}
        onLoadEnd={() => {
          if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
            setShowStartupLoading(false);
          }
          syncPushTokenWithWebsite();
        }}
        onNavigationStateChange={handleNavigation}
        onShouldStartLoadWithRequest={handleShouldStart}
        onError={(event) => {
          const description = String(event.nativeEvent.description || "").trim();
          setLoadError(description || "Falha ao abrir o site.");
          setLastHttpStatus(null);
          setShowStartupLoading(false);
        }}
        onHttpError={(event) => {
          const status = Number(event.nativeEvent.statusCode || 0);
          setLastHttpStatus(status > 0 ? status : null);
          setLoadError(
            status > 0
              ? `Erro HTTP ${status}. O conteúdo não pôde ser carregado.`
              : "Não foi possível carregar o conteúdo.",
          );
          setShowStartupLoading(false);
        }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures={false}
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        allowsPictureInPictureMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled
        cacheEnabled
        mixedContentMode="always"
        overScrollMode="never"
        bounces={false}
        pullToRefreshEnabled={false}
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        nestedScrollEnabled={false}
        androidLayerType="hardware"
        cacheMode="LOAD_DEFAULT"
        onRenderProcessGone={handleWebProcessCrash}
        onContentProcessDidTerminate={handleWebProcessCrash}
        style={styles.webView}
      />

      {showStartupLoading && (
        <View style={styles.loadingOverlay}>
          <Image source={require("./assets/icon.png")} style={styles.loadingLogo} />
          <ActivityIndicator size="large" color="#e2e8f0" />
        </View>
      )}

      {showErrorOverlay && (
        <View style={styles.errorOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.errorTitle}>{errorTitle}</Text>
            <Text style={styles.errorText}>{errorDescription}</Text>
            {lastHttpStatus ? (
              <Text style={styles.errorCode}>Código HTTP: {lastHttpStatus}</Text>
            ) : null}
            <View style={styles.errorActions}>
              <Pressable style={styles.exitButton} onPress={handleExitApp}>
                <Text style={styles.exitText}>Sair</Text>
              </Pressable>
              <Pressable style={styles.retryButton} onPress={retryWebView}>
                <Text style={styles.retryText}>Retentar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07070a",
  },
  webView: {
    flex: 1,
    backgroundColor: "#07070a",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07070a",
    gap: 12,
  },
  loadingLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  webFallback: {
    flex: 1,
    backgroundColor: "#07070a",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.74)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingBottom: 40,
  },
  errorModal: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#f5f7fb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d7dce5",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  errorTitle: {
    color: "#161a22",
    fontWeight: "800",
    fontSize: 20,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    color: "#2f3747",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 10,
  },
  errorCode: {
    color: "#516078",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 12,
  },
  errorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exitButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#c6cedc",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  exitText: {
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 14,
  },
  retryButton: {
    flex: 1,
    backgroundColor: "#0f131a",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  retryText: {
    color: "#f9fafb",
    fontWeight: "800",
    fontSize: 14,
  },
});
