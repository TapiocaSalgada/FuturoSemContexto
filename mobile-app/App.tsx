import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
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

  const [sourceUrl, setSourceUrl] = useState(DEFAULT_BASE_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showStartupLoading, setShowStartupLoading] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);

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

    const payload = JSON.stringify({
      token: pushToken,
      platform: Platform.OS,
      deviceName: Device.deviceName || "",
    });

    const escapedPayload = JSON.stringify(payload);
    const script = `(function(){try{fetch('/api/mobile/push/register',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:${escapedPayload}});}catch(e){}true;})();`;
    webRef.current.injectJavaScript(script);
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
    setCanGoBack(state.canGoBack);
  };

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <WebView
        ref={webRef}
        source={{ uri: sourceUrl }}
        onLoadStart={() => {
          setLoadError(null);
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
        onError={(event) => {
          setLoadError(event.nativeEvent.description || "Falha ao abrir o site.");
          setShowStartupLoading(false);
        }}
        onHttpError={(event) => {
          setLoadError(`Erro HTTP ${event.nativeEvent.statusCode}`);
          setShowStartupLoading(false);
        }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures={false}
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        allowsFullscreenVideo
        mediaPlaybackRequiresUserAction={false}
        domStorageEnabled
        cacheEnabled
        mixedContentMode="always"
        overScrollMode="never"
        bounces={false}
        pullToRefreshEnabled={false}
        androidLayerType="hardware"
        style={styles.webView}
      />

      {showStartupLoading && (
        <View style={styles.loadingOverlay}>
          <Image source={require("./assets/icon.png")} style={styles.loadingLogo} />
          <ActivityIndicator size="large" color="#ff2a97" />
        </View>
      )}

      {loadError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Nao foi possivel carregar</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => {
              setLoadError(null);
              setShowStartupLoading(true);
              hasLoadedOnceRef.current = false;
              webRef.current?.reload();
            }}
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
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
  errorBox: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: "#171a24",
    borderColor: "#2d3346",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  errorTitle: {
    color: "#ffffff",
    fontWeight: "800",
    marginBottom: 4,
  },
  errorText: {
    color: "#adb3c5",
    fontSize: 12,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: "#ff2a97",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 10,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 12,
  },
});
