import React from 'react';
import Home from './pages/Home/Home';
import PersonalityTest from './pages/PersonalityTest/PersonalityTest';
import Contact from './pages/Contact/Contact';
import Login from './pages/Login/Login';
import Results from './pages/Results/Results';
import ResetPassword from './pages/ResetPassword/ResetPassword';
import AuthCallback from './pages/AuthCallback/AuthCallback';

export interface Route {
  path: string;
  component: React.ComponentType;
  name: string;
  showInNav: boolean;
  children?: Route[];
}

const routes: Route[] = [
  {
    path: '/',
    component: Home,
    name: 'HOME',
    showInNav: true,
  },
  {
    path: '/personality-test/intro',
    component: PersonalityTest,
    name: 'PERSONALITY TEST',
    showInNav: true,
  },
  {
    path: '/personality-test/results',
    component: Results,
    name: 'RESULTS',
    showInNav: false,
  },
  {
    path: '/results',
    component: Results,
    name: 'RESULTS',
    showInNav: false,
  },
  {
    path: '/contact',
    component: Contact,
    name: 'CONTACT US',
    showInNav: true,
  },
  {
    path: '/login',
    component: Login,
    name: 'LOGIN',
    showInNav: true,
  },
  {
    path: '/reset-password',
    component: ResetPassword,
    name: 'RESET PASSWORD',
    showInNav: false,
  },
  {
    path: '/auth/callback',
    component: AuthCallback,
    name: 'AUTH CALLBACK',
    showInNav: false,
  },
];

export default routes; 