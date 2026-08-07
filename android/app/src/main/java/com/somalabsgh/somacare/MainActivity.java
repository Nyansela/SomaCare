package com.somalabsgh.somacare;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Disable Android Autofill on the WebView to prevent UI thread freezing when inputs gain focus
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);
        }
    }
}
