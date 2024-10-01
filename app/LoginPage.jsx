import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { User, Lock, Loader } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Styled components (LoginContainer, LoginCard, Title, Form, InputGroup, Input, IconWrapper, Button) remain the same

const ErrorMessage = styled.div`
  color: red;
  margin-top: 1rem;
  text-align: center;
`;

// Assuming you're using an environment variable for the server base URL
const SERVER_BASE = "https://mentor-server-theta.vercel.app";
const SERVER = `${SERVER_BASE}/allUsers`;
const UPDATE_PASSWORD = `${SERVER_BASE}/updatePassword`;

const LoginContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
`;

const LoginCard = styled.div`
  background-color: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const Title = styled.h2`
  text-align: center;
  color: #333;
  margin-bottom: 1.5rem;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
`;

const InputGroup = styled.div`
  position: relative;
  margin-bottom: 1rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  padding-left: 2.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const IconWrapper = styled.span`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #666;
`;

const Button = styled.button`
  background-color: #4a90e2;
  color: white;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s;
  &:hover {
    background-color: #3a7cbd;
  }
`;


const LoadingOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const LoadingSpinner = styled(Loader)`
  animation: spin 1s linear infinite;
  @keyframes spin {
    100% {
      transform: rotate(360deg);
    }
  }
`;
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingUsers, setIsFetchingUsers] = useState(true);
  const router = useRouter();

  useEffect(() => {
      fetchUsers();
  }, []);

  const fetchUsers = async () => {
      setIsFetchingUsers(true);
      try {
          const response = await fetch(SERVER, {
              method: 'GET',
              mode: 'cors',
              credentials: 'same-origin',
              headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
              }
          });
          const data = await response.json();
          setUsers(data);
      } catch (error) {
          console.error('Error fetching users:', error);
          setError('Failed to fetch users. Please try again.');
      } finally {
          setIsFetchingUsers(false);
      }
  };

  const storeUserInfo = (user) => {
      localStorage.setItem("currentUser", JSON.stringify({
          email: user.email,
          name: user.firstName
      }));
  };

  const handleLogin = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');

      const user = users.find(item => item.email === email);

      if (password === "shenkar") {
          setChangePassword(true);
      } else if (user && password === user.password) {
          storeUserInfo(user);
          router.push('/entities/basic-chat');
      } else {
          setError('Wrong Password or Email');
          setTimeout(() => setError(''), 3000);
      }

      setIsLoading(false);
  };

  const handleChangePassword = async (e) => {
      e.preventDefault();
      setIsLoading(true);
      setError('');

      if (newPassword && newPassword !== "shenkar") {
          const user = users.find(item => item.email === email);
          if (user) {
              try {
                  const response = await fetch(UPDATE_PASSWORD, {
                      method: 'POST',
                      mode: 'cors',
                      credentials: 'same-origin',
                      headers: {
                          'Content-Type': 'application/json',
                          'Access-Control-Allow-Origin': '*'
                      },
                      body: JSON.stringify({
                          "email": email,
                          "password": newPassword
                      })
                  });
                  if (response.ok) {
                      storeUserInfo(user);
                      router.push('/entities/basic-chat');
                  } else {
                      setError('Failed to update password');
                  }
              } catch (error) {
                  console.error('Error updating password:', error);
                  setError('Failed to update password');
              }
          }
      } else {
          setError('Invalid new password');
          setTimeout(() => setError(''), 3000);
      }

      setIsLoading(false);
  };

  if (isFetchingUsers) {
      return (
          <LoginContainer>
              <LoadingOverlay>
                  <LoadingSpinner size={48} />
              </LoadingOverlay>
          </LoginContainer>
      );
  }

  return (
      <LoginContainer>
          <LoginCard>
              <Title>התחברות</Title>
              {!changePassword ? (
                  <Form onSubmit={handleLogin}>
                      <InputGroup>
                          <IconWrapper>
                              <User size={18} />
                          </IconWrapper>
                          <Input 
                              type="email" 
                              placeholder="כתובת מייל" 
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                          />
                      </InputGroup>
                      <InputGroup>
                          <IconWrapper>
                              <Lock size={18} />
                          </IconWrapper>
                          <Input 
                              type="password" 
                              placeholder="סיסמה"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                          />
                      </InputGroup>
                      <Button type="submit" disabled={isLoading}>
                          {isLoading ? <LoadingSpinner size={18} /> : 'אישור'}
                      </Button>
                  </Form>
              ) : (
                  <Form onSubmit={handleChangePassword}>
                      <InputGroup>
                          <IconWrapper>
                              <Lock size={18} />
                          </IconWrapper>
                          <Input 
                              type="password" 
                              placeholder="סיסמה חדשה"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                          />
                      </InputGroup>
                      <Button type="submit" disabled={isLoading}>
                          {isLoading ? <LoadingSpinner size={18} /> : 'שנה סיסמה'}
                      </Button>
                  </Form>
              )}
              {error && <ErrorMessage>{error}</ErrorMessage>}
          </LoginCard>
          {isLoading && (
              <LoadingOverlay>
                  <LoadingSpinner size={48} />
              </LoadingOverlay>
          )}
      </LoginContainer>
  );
};

export default LoginPage;