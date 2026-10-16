package com.antony.legendador;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 7001;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectAssetJavascript(view, "v4_patch.js");
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Não foi possível abrir os arquivos.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new AndroidSaver(getContentResolver()), "AndroidSave");
        loadEditorWithSecureOrigin();
    }

    private String readAssetText(String name) throws Exception {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }

    private void injectAssetJavascript(WebView view, String assetName) {
        try {
            String javascript = readAssetText(assetName);
            view.evaluateJavascript(javascript, null);
        } catch (Exception e) {
            Toast.makeText(this, "Falha ao carregar os controles do editor.", Toast.LENGTH_LONG).show();
        }
    }

    private void loadEditorWithSecureOrigin() {
        try {
            String html = readAssetText("index.html");
            webView.loadDataWithBaseURL("https://legendador.local/", html, "text/html", "UTF-8", null);
        } catch (Exception e) {
            Toast.makeText(this, "Falha ao abrir o editor.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) webView.destroy();
        super.onDestroy();
    }

    public class AndroidSaver {
        private final ContentResolver resolver;
        private final Map<String, SaveSession> sessions = new ConcurrentHashMap<>();

        AndroidSaver(ContentResolver resolver) {
            this.resolver = resolver;
        }

        @JavascriptInterface
        public String beginSave(String fileName, String mimeType) {
            try {
                boolean video = mimeType != null && mimeType.startsWith("video/");
                boolean image = mimeType != null && mimeType.startsWith("image/");
                Uri collection = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                        : image ? MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                        : MediaStore.Downloads.EXTERNAL_CONTENT_URI;

                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, sanitize(fileName));
                values.put(MediaStore.MediaColumns.MIME_TYPE,
                        mimeType == null || mimeType.isBlank() ? "application/octet-stream" : mimeType);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                if (video) values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/Legendador");
                else if (image) values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Legendador");
                else values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Legendador");

                Uri uri = resolver.insert(collection, values);
                if (uri == null) throw new IllegalStateException("MediaStore não criou o arquivo");
                OutputStream out = resolver.openOutputStream(uri, "w");
                if (out == null) throw new IllegalStateException("Não foi possível abrir o arquivo");

                String id = UUID.randomUUID().toString();
                sessions.put(id, new SaveSession(uri, out));
                return id;
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        @JavascriptInterface
        public void appendChunk(String id, String base64) {
            SaveSession session = sessions.get(id);
            if (session == null) throw new IllegalStateException("Sessão de salvamento inválida");
            try {
                session.out.write(Base64.decode(base64, Base64.DEFAULT));
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }

        @JavascriptInterface
        public void finishSave(String id) {
            SaveSession session = sessions.remove(id);
            if (session == null) return;
            try {
                session.out.flush();
                session.out.close();
                ContentValues done = new ContentValues();
                done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(session.uri, done, null, null);
                runOnUiThread(() -> Toast.makeText(MainActivity.this,
                        "Arquivo salvo em Legendador", Toast.LENGTH_SHORT).show());
            } catch (Exception e) {
                resolver.delete(session.uri, null, null);
                throw new RuntimeException(e);
            }
        }

        @JavascriptInterface
        public void cancelSave() {
            for (Map.Entry<String, SaveSession> e : sessions.entrySet()) {
                try { e.getValue().out.close(); } catch (Exception ignored) {}
                try { resolver.delete(e.getValue().uri, null, null); } catch (Exception ignored) {}
            }
            sessions.clear();
        }

        private String sanitize(String s) {
            if (s == null || s.isBlank()) return "legendador-" + System.currentTimeMillis();
            return s.replaceAll("[\\\\/:*?\"<>|]", "_");
        }
    }

    private static class SaveSession {
        final Uri uri;
        final OutputStream out;
        SaveSession(Uri uri, OutputStream out) {
            this.uri = uri;
            this.out = out;
        }
    }
}
