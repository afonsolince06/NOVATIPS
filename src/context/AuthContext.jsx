import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithPassword = async (email, password) => {
    if (!email.endsWith('@novaims.unl.pt')) {
      throw new Error('Use your NOVA IMS institutional email.');
    }

    // Attempt to sign in
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      // If invalid credentials, we can't be sure if user doesn't exist or wrong password
      // Let's attempt to sign up
      if (error.message.includes('Invalid login') || error.message.includes('credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          if (signUpError.message.includes('already registered')) {
            throw new Error('Password errada! Tenta novamente.');
          }
          throw new Error(signUpError.message);
        }
        return; // successfully signed up and logged in
      }
      throw new Error(error.message);
    }
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

export const useAuth = () => useContext(AuthContext);
