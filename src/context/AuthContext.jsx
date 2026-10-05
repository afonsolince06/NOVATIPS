import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthContext } from './AuthContextValue';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(() => sessionStorage.getItem('passwordRecovery') === 'true');
  const finishPasswordRecovery = () => { sessionStorage.removeItem('passwordRecovery'); setPasswordRecovery(false); };

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
      if (_event === 'PASSWORD_RECOVERY') { sessionStorage.setItem('passwordRecovery', 'true'); setPasswordRecovery(true); }
      if (_event === 'SIGNED_OUT') finishPasswordRecovery();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const normalizeEmail = (email) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@novaims.unl.pt')) throw new Error('Usa o teu email institucional @novaims.unl.pt.');
    return normalized;
  };

  const signInWithPassword = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
    if (error) {
      if (error.code === 'invalid_credentials' || /invalid login|credentials/i.test(error.message)) throw new Error('Email ou password incorretos. Tenta novamente ou redefine a password.');
      if (error.code === 'email_not_confirmed') throw new Error('Confirma primeiro o teu endereço no email de registo.');
      throw new Error(error.message);
    }
    return { requiresEmailConfirmation: false };
  };

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email: normalizeEmail(email), password });
    if (error) {
      if (error.code === 'user_already_exists' || /already registered|already exists/i.test(error.message)) return { accountExists: true };
      if (/database error saving new user/i.test(error.message)) throw new Error('Não foi possível criar a conta. Confirma que o email está na lista do FDS.');
      throw new Error(error.message);
    }
    return { requiresEmailConfirmation: !data.session };
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo: window.location.origin + '/' });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithPassword, signUp, resetPassword, passwordRecovery, finishPasswordRecovery, signOut }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
