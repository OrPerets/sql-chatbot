// This file serves as the Next.js page route for the admin interface (/admin).
// It imports and renders the AdminPage component from components directory.
// We need this file to create a proper route in Next.js, while keeping the main component logic separate in the components folder.

"use client";

import React from 'react';
import AdminPage from '../components/admin_page';

export default function Admin() {
  return <AdminPage />;}