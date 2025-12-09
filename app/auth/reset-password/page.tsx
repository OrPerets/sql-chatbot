'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Loader, CheckCircle, XCircle } from 'lucide-react'
import styles from './reset-password.module.css'

export default function ResetPasswordPage() {
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
      validateToken(tokenParam)
    } else {
      setError('קישור לא תקין')
      setIsValidating(false)
    }
  }, [searchParams])

  const validateToken = async (tokenToValidate: string) => {
    try {
      const response = await fetch(`/api/auth/reset-password/validate?token=${tokenToValidate}`)
      const data = await response.json()
      
      if (response.ok && data.valid) {
        setEmail(data.email)
      } else {
        setError(data.error || 'קישור לא תקין או פג תוקף')
      }
    } catch (error) {
      console.error('Error validating token:', error)
      setError('שגיאה באימות הקישור')
    } finally {
      setIsValidating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    if (newPassword !== confirmPassword) {
      setError('הסיסמאות אינן תואמות')
      setIsLoading(false)
      return
    }

    if (newPassword.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים')
      setIsLoading(false)
      return
    }

    if (newPassword === 'shenkar') {
      setError('לא ניתן להשתמש בסיסמה ברירת המחדל')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword
        })
      })

      const data = await response.json()
      
      if (response.ok) {
        setSuccess(true)
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } else {
        setError(data.error || 'שגיאה באיפוס הסיסמה')
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      setError('שגיאה באיפוס הסיסמה')
    } finally {
      setIsLoading(false)
    }
  }

  if (isValidating) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <Loader className={styles.loadingSpinner} size={48} />
          <p>מאמת קישור...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <CheckCircle className={styles.successIcon} size={48} />
          <h2>הסיסמה עודכנה בהצלחה!</h2>
          <p>תועבר לעמוד הכניסה בעוד מספר שניות...</p>
        </div>
      </div>
    )
  }

  if (error && !email) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <XCircle className={styles.errorIcon} size={48} />
          <h2>שגיאה</h2>
          <p>{error}</p>
          <button 
            className={styles.button}
            onClick={() => router.push('/')}
          >
            חזור לעמוד הכניסה
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h2>איפוס סיסמה</h2>
        <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
          הזן סיסמה חדשה עבור {email}
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <span className={styles.iconWrapper}>
              <Lock size={18} />
            </span>
            <input 
              type="password" 
              className={styles.input}
              placeholder="סיסמה חדשה"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
          </div>
          
          <div className={styles.inputGroup}>
            <span className={styles.iconWrapper}>
              <Lock size={18} />
            </span>
            <input 
              type="password" 
              className={styles.input}
              placeholder="אישור סיסמה"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? <Loader className={styles.loadingSpinner} size={18} /> : 'אפס סיסמה'}
          </button>
        </form>
        
        {error && <div className={styles.errorMessage}>{error}</div>}
      </div>
    </div>
  )
}
