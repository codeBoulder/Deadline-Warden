import React, { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const Icon = ({ name, className = '', style = {} }) => (
  <span className={`material-symbols-outlined ${className}`} style={{ verticalAlign: 'middle', ...style }}>{name}</span>
);

export default function Auth({ onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); 
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      onClose(); 
    } catch (err) {
      if (err.code === 'auth/invalid-credential') setError('Неправильний email або пароль.');
      else if (err.code === 'auth/email-already-in-use') setError('Цей email вже зареєстровано.');
      else if (err.code === 'auth/weak-password') setError('Пароль має бути не менше 6 символів.');
      else setError('Сталася помилка: ' + err.message);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        
        <button className="auth-close" onClick={onClose}><Icon name="close" /></button>
        
        <div className="auth-header">
          <Icon name="hourglass_bottom" style={{ fontSize: '3.5rem', color: 'var(--accent)', marginBottom: '16px' }} />
          <h2>{isLogin ? 'З поверненням!' : 'Створити акаунт'}</h2>
          <p>{isLogin ? 'Увійдіть до системи, щоб продовжити' : 'Створіть свій особистий простір дедлайнів'}</p>
        </div>

        {error && <div className="auth-error"><Icon name="error" /> {error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>Електронна пошта</label>
            <input 
              type="email" 
              placeholder="student@university.edu" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn-primary auth-submit">
            {isLogin ? 'Увійти до акаунту' : 'Зареєструватись'}
          </button>
        </form>

        <div className="auth-footer">
          <p onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Немає акаунту? ' : 'Вже є акаунт? '}
            <span>{isLogin ? 'Створити зараз' : 'Увійти'}</span>
          </p>
        </div>

      </div>
    </div>
  );
}