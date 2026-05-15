"use client";

import React from 'react';
import AdminShell from "@/app/components/admin/AdminShell";
import McpMichaelPage from '../../components/McpMichaelPage';

const McpMichaelAdminPage: React.FC = () => {
  return (
    <AdminShell>
      <McpMichaelPage />
    </AdminShell>
  );
};

export default McpMichaelAdminPage;
