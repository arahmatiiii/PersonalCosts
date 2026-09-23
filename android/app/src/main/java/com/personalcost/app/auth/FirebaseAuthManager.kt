package com.personalcost.app.auth

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

/** Email/password auth against the same single Firebase account the web app uses. */
object FirebaseAuthManager {
    private val auth: FirebaseAuth get() = FirebaseAuth.getInstance()

    val isSignedIn: Boolean get() = auth.currentUser != null
    val email: String? get() = auth.currentUser?.email

    suspend fun signIn(email: String, password: String) {
        auth.signInWithEmailAndPassword(email.trim(), password).await()
    }

    fun signOut() = auth.signOut()
}
