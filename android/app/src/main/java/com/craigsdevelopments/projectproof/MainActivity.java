package com.craigsdevelopments.projectproof;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new InvoiceBridge(), "ProjectProofAndroid");
    }

    private class InvoiceBridge {
        @JavascriptInterface
        public void saveInvoice(String filename, String base64Pdf, boolean email, String subject, String body) {
            try {
                String cleanName = sanitizeFilename(filename);
                File invoiceDir = new File(getCacheDir(), "invoices");
                if (!invoiceDir.exists() && !invoiceDir.mkdirs()) {
                    throw new IOException("Could not create invoice folder");
                }
                File invoiceFile = new File(invoiceDir, cleanName);
                byte[] pdfBytes = Base64.decode(base64Pdf, Base64.DEFAULT);
                try (FileOutputStream output = new FileOutputStream(invoiceFile)) {
                    output.write(pdfBytes);
                }

                Uri uri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    invoiceFile
                );

                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("application/pdf");
                intent.putExtra(Intent.EXTRA_STREAM, uri);
                intent.putExtra(Intent.EXTRA_SUBJECT, subject);
                intent.putExtra(Intent.EXTRA_TEXT, body);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                String title = email ? "Email invoice" : "Save or share invoice";
                runOnUiThread(() -> {
                    try {
                        startActivity(Intent.createChooser(intent, title));
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(MainActivity.this, "No app found to open invoice", Toast.LENGTH_LONG).show();
                    }
                });
            } catch (Exception error) {
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "Invoice could not be created", Toast.LENGTH_LONG).show()
                );
            }
        }

        private String sanitizeFilename(String filename) {
            String clean = filename == null ? "projectproof-invoice.pdf" : filename.replaceAll("[^A-Za-z0-9._-]", "-");
            if (!clean.toLowerCase().endsWith(".pdf")) clean = clean + ".pdf";
            return clean;
        }
    }
}
