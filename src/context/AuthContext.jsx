import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthContext } from './AuthContextValue';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setUser(null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email, password) => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith('@novaims.unl.pt')) {
      throw new Error('Use your NOVA IMS institutional email.');
    }

    // Attempt to sign in
    const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    
    if (error) {
      // If invalid credentials, we can't be sure if user doesn't exist or wrong password
      // Let's attempt to sign up
      if (error.message.includes('Invalid login') || error.message.includes('credentials')) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: normalizedEmail, password });
        if (signUpError) {
          if (signUpError.message.toLowerCase().includes('already registered')) {
            throw new Error('Password errada! Tenta novamente.');
          }
          if (signUpError.message.toLowerCase().includes('database error saving new user')) {
            throw new Error('Não foi possível criar a conta. Confirma que o email está na lista do FDS e tenta novamente.');
          }
          throw new Error(signUpError.message);
        }
        return { requiresEmailConfirmation: !data.session, user: data.user };
      }
      throw new Error(error.message);
    }

    return { requiresEmailConfirmation: false, user: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithPassword, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
