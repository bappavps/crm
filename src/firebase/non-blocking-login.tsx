'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { errorEmitter } from './error-emitter';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance).catch((error) => {
    errorEmitter.emit('auth-error', {
      title: 'Guest Login Failed',
      message: error.message
    });
  });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password).catch((error) => {
    errorEmitter.emit('auth-error', {
      title: 'Sign Up Failed',
      message: error.message
    });
  });
}

/** 
 * Initiate email/password sign-in (non-blocking). 
 * Includes prototype auto-provisioning logic for first-time login.
 */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password).catch((error) => {
    // Prototype workflow: If account doesn't exist, try to sign up automatically
    // if the credentials match the default employee onboarding template.
    const isNewEmployee = (
      (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') && 
      email.toLowerCase().endsWith('@shreelabel.com') && 
      password === 'admin@123'
    );

    if (isNewEmployee) {
      createUserWithEmailAndPassword(authInstance, email, password).catch((signUpError) => {
        errorEmitter.emit('auth-error', {
          title: 'Login Error',
          message: signUpError.message
        });
      });
    } else {
      errorEmitter.emit('auth-error', {
        title: 'Authentication Failed',
        message: 'Invalid email or password. Please verify your credentials.'
      });
    }
  });
}
