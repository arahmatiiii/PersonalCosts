package com.personalcost.app.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.personalcost.app.BuildConfig
import com.personalcost.app.R
import com.personalcost.app.auth.FirebaseAuthManager
import com.personalcost.app.data.BankRulesCache
import com.personalcost.app.data.DebugLog
import com.personalcost.app.data.PendingQueue
import com.personalcost.app.ingest.TransactionIngestor
import com.personalcost.app.reminder.ReminderScheduler
import kotlinx.coroutines.launch
import java.text.DateFormat
import java.util.Date

/**
 * Deliberately minimal: one-time sign-in, then a status screen that makes every silent failure mode
 * visible (listener access, SMS permission, battery optimization, rules sync, parse log).
 * Reviewing/tagging transactions happens in the PWA.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var root: LinearLayout

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { render() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(32))
        }
        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() {
        super.onResume()
        render()
        if (FirebaseAuthManager.isSignedIn) syncNow(quiet = true)
    }

    private fun render() {
        root.removeAllViews()
        if (!FirebaseAuthManager.isSignedIn) renderSignIn() else renderStatus()
    }

    // ---------- Sign-in ----------

    private fun renderSignIn() {
        title("ورود به PersonalCost")
        text("با همان حساب ایمیل/رمزی که در نسخه وب استفاده می‌کنید وارد شوید.")
        val email = EditText(this).apply {
            hint = "email"
            inputType = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            textDirection = View.TEXT_DIRECTION_LTR
        }
        val password = EditText(this).apply {
            hint = "password"
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
            textDirection = View.TEXT_DIRECTION_LTR
        }
        root.addView(email)
        root.addView(password)
        button("ورود") {
            lifecycleScope.launch {
                try {
                    FirebaseAuthManager.signIn(email.text.toString(), password.text.toString())
                    syncNow(quiet = false)
                    render()
                } catch (e: Exception) {
                    toast("خطا: ${e.message}")
                }
            }
        }
    }

    // ---------- Status ----------

    @SuppressLint("BatteryLife")
    private fun renderStatus() {
        title("وضعیت PersonalCost")
        text("وارد شده با: ${FirebaseAuthManager.email}")

        val batteryOk = (getSystemService(POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(packageName)
        if (!batteryOk) {
            banner(
                "⚠️ بهینه‌سازی باتری برای این اپ فعال است. اندروید ممکن است سرویس دریافت اعلان را در پس‌زمینه متوقف کند " +
                    "و تراکنش‌ها بی‌صدا ثبت نشوند. حتماً غیرفعالش کنید."
            )
        }

        section("دسترسی‌ها")
        val listenerOk = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
        status("دسترسی به اعلان‌ها (Notification access)", listenerOk, "باز کردن تنظیمات") {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        val smsOk = granted(Manifest.permission.RECEIVE_SMS) && granted(Manifest.permission.READ_SMS)
        status("دسترسی پیامک", smsOk, "اعطای دسترسی") {
            permissionLauncher.launch(arrayOf(Manifest.permission.RECEIVE_SMS, Manifest.permission.READ_SMS))
        }
        if (Build.VERSION.SDK_INT >= 33) {
            status("اجازه نمایش اعلان (برای یادآور)", granted(Manifest.permission.POST_NOTIFICATIONS), "اعطای دسترسی") {
                permissionLauncher.launch(arrayOf(Manifest.permission.POST_NOTIFICATIONS))
            }
        }
        status("مستثنی از بهینه‌سازی باتری", batteryOk, "درخواست") {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        }
        text(
            "در گوشی‌های شیائومی/سامسونگ/هواوی علاوه بر این، «اجرای خودکار» (Autostart) را فعال و اپ را در لیست اپ‌های " +
                "اخیر قفل کنید.",
            small = true,
        )

        section("قوانین بانک‌ها")
        val last = BankRulesCache.lastSyncMillis
        status(
            "آخرین همگام‌سازی: " + if (last == 0L) "هرگز" else DateFormat.getDateTimeInstance().format(Date(last)),
            last != 0L && System.currentTimeMillis() - last < 24 * 3600_000L,
            "همگام‌سازی الان",
            alwaysShowAction = true,
        ) { syncNow(quiet = false) }
        BankRulesCache.lastError?.let { text("خطای آخر: $it", small = true, color = R.color.bad) }
        val banks = BankRulesCache.all
        text("${banks.count { it.enabled }} بانک فعال از ${banks.size}")
        banks.forEach { b ->
            val placeholder = (b.matchPackages + b.matchSenderIds).any { it.startsWith("VERIFY_ME") }
            text(
                "• ${b.name}${if (!b.enabled) " (غیرفعال)" else ""}${if (placeholder) " — ⚠️ مقادیر placeholder، روی گوشی بررسی شود" else ""}",
                small = true,
                color = if (placeholder) R.color.warn else null,
            )
        }
        PendingQueue.size.takeIf { it > 0 }?.let { text("$it مورد در صف پردازش", color = R.color.warn) }

        section("یادآور")
        val r = BankRulesCache.cachedReminder
        text(if (r.enabled) "هر روز ساعت %02d:%02d (قابل تغییر از تنظیمات نسخه وب)".format(r.hour, r.minute) else "غیرفعال")

        section("لاگ اعلان‌ها/پیامک‌های خام (دیباگ)")
        text(
            "هر پیامک/اعلانی که به یک بانک تطبیق داده شده، همراه با نتیجه پارس اینجا ثبت می‌شود. موارد UNPARSED یعنی regex " +
                "مبلغ اشتباه است. این لاگ فقط روی همین گوشی می‌ماند.",
            small = true,
        )
        root.addView(Switch(this).apply {
            text = "ثبت همه اعلان‌ها و پیامک‌ها (برای پیدا کردن نام پکیج/فرستنده)"
            isChecked = DebugLog.captureAll
            setOnCheckedChangeListener { _, on -> DebugLog.captureAll = on }
        })
        val logView = TextView(this).apply {
            typeface = Typeface.MONOSPACE
            textSize = 11f
            setTextIsSelectable(true)
            visibility = View.GONE
            textDirection = View.TEXT_DIRECTION_ANY_RTL
        }
        row(
            "نمایش لاگ" to {
                logView.text = DebugLog.dump()
                logView.visibility = if (logView.visibility == View.VISIBLE) View.GONE else View.VISIBLE
            },
            "کپی" to {
                (getSystemService(CLIPBOARD_SERVICE) as ClipboardManager)
                    .setPrimaryClip(ClipData.newPlainText("PersonalCost log", DebugLog.dump()))
                toast("کپی شد")
            },
            "پاک کردن" to {
                DebugLog.clear()
                logView.text = DebugLog.dump()
            },
        )
        root.addView(logView)

        section("")
        button("باز کردن نسخه وب") { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.PWA_URL))) }
        button("خروج از حساب") {
            FirebaseAuthManager.signOut()
            render()
        }
    }

    private fun syncNow(quiet: Boolean) {
        lifecycleScope.launch {
            try {
                val reminder = BankRulesCache.refresh()
                ReminderScheduler.schedule(applicationContext, reminder)
                TransactionIngestor.drainPending()
                if (!quiet) toast("همگام‌سازی انجام شد")
            } catch (e: Exception) {
                if (!quiet) toast("همگام‌سازی ناموفق: ${e.message}")
            }
            render()
        }
    }

    // ---------- tiny view helpers ----------

    private fun granted(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

    private fun title(s: String) = root.addView(TextView(this).apply {
        text = s
        textSize = 22f
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, 0, 0, dp(8))
    })

    private fun section(s: String) = root.addView(TextView(this).apply {
        text = s
        textSize = 17f
        setTypeface(typeface, Typeface.BOLD)
        setPadding(0, dp(20), 0, dp(6))
    })

    private fun text(s: String, small: Boolean = false, color: Int? = null) = root.addView(TextView(this).apply {
        text = s
        textSize = if (small) 13f else 15f
        color?.let { setTextColor(ContextCompat.getColor(this@MainActivity, it)) }
        setPadding(0, dp(2), 0, dp(2))
    })

    private fun banner(s: String) = root.addView(TextView(this).apply {
        text = s
        textSize = 15f
        setTextColor(0xFFFFFFFF.toInt())
        setBackgroundColor(ContextCompat.getColor(this@MainActivity, R.color.bad))
        setPadding(dp(12), dp(12), dp(12), dp(12))
    })

    private fun status(label: String, ok: Boolean, action: String, alwaysShowAction: Boolean = false, onClick: () -> Unit) {
        val line = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(4), 0, dp(4))
        }
        line.addView(TextView(this).apply {
            text = (if (ok) "✅ " else "❌ ") + label
            textSize = 15f
            setTextColor(ContextCompat.getColor(this@MainActivity, if (ok) R.color.ok else R.color.bad))
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        })
        if (!ok || alwaysShowAction) {
            line.addView(Button(this).apply {
                text = action
                setOnClickListener { onClick() }
            })
        }
        root.addView(line)
    }

    private fun button(label: String, onClick: () -> Unit) = root.addView(Button(this).apply {
        text = label
        setOnClickListener { onClick() }
    })

    private fun row(vararg buttons: Pair<String, () -> Unit>) {
        val line = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        buttons.forEach { (label, onClick) ->
            line.addView(Button(this).apply {
                text = label
                setOnClickListener { onClick() }
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            })
        }
        root.addView(line)
    }

    private fun toast(s: String) = Toast.makeText(this, s, Toast.LENGTH_LONG).show()
}
