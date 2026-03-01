import { AuthResponse, Session } from '@supabase/supabase-js';
import { supabase } from '../../supabase/supabaseClient';

/**
 * Authentication API wrapper for Supabase Auth.
 */
export const authApi = {
  /**
   * Signs up a new user with email, password, and optional metadata.
   */
  async signUp(email: string, password: string, metadata?: object, redirectTo?: string): Promise<AuthResponse> {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        emailRedirectTo: redirectTo
      }
    });
  },

  /**
   * Signs in an existing user with email and password.
   */
  async signIn(email: string, password: string): Promise<AuthResponse> {
    return await supabase.auth.signInWithPassword({ email, password });
  },

  /**
   * Signs out the current user session.
   */
  async signOut(): Promise<{ error: Error | null }> {
    return await supabase.auth.signOut();
  },

  /**
   * Retrieves the current session data.
   */
  async getSession(): Promise<{ data: { session: Session | null }; error: Error | null }> {
    return await supabase.auth.getSession();
  },

  /**
   * Sends a one-time password (OTP) to the specified email.
   * When called after signup, Supabase automatically sends a verification email.
   */
  async sendOTP(email: string): Promise<{ data: unknown; error: Error | null }> {
    return await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  },

  /**
   * Verifies the 6-digit OTP token submitted by the user.
   *
   * @param email - The email address the OTP was sent to.
   * @param token - The 6-digit OTP code entered by the user.
   */
  async verifyOTP(email: string, token: string): Promise<{ data: { session: import('@supabase/supabase-js').Session | null }; error: Error | null }> {
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    return { data: { session: data.session ?? null }, error };
  },

  /**
   * Listens for changes in the authentication state.
   */
  onAuthStateChange(callback: (event: string, session: Session | null) => void): { data: { subscription: any } } {
    return supabase.auth.onAuthStateChange(callback as any);
  },

  /**
   * Refreshes the session using a refresh token.
   */
  async refreshSession(refreshToken: string): Promise<{ data: { session: Session | null }; error: Error | null }> {
    return await supabase.auth.refreshSession({ refresh_token: refreshToken });
  }
};
