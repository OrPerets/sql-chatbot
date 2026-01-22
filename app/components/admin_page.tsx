"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Settings, BarChart3, Search, Upload, Shield, Clock, Plus, X } from 'lucide-react';
import ModernAdminLayout from './admin/ModernAdminLayout';
import ModernDashboard from './admin/ModernDashboard';
import StatsCard from './admin/StatsCard';
import MissingAnswersAudit from './admin/MissingAnswersAudit';
import ErrorBanner from './admin/ErrorBanner';
import SkeletonCard from './admin/SkeletonCard';
import SearchBar from './admin/SearchBar';
import BulkActions from './admin/BulkActions';
import UsersList from './admin/UsersList';
import EnhancedSettingsToggle from './admin/EnhancedSettingsToggle';
import StudentProfiles from './admin/StudentProfiles';
import AnalysisManagement from './admin/AnalysisManagement';
import styles from './admin_page.module.css';

const options = {
  'add_balance': 'הוסף מטבעות',
  'reduce_balance': 'הפחת מטבעות',
  'reset_password': 'איפוס סיסמה'
}

const AdminPage: React.FC = () => {
 const [currentUser, setCurrentUser] = useState(null);
 const [error, setError] = useState('');
 const [users, setUsers] = useState([]);
 const [classes, setClasses] = useState([{ id: 0, name: 'כל הכיתות' }]);
 const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(true);
 const [isStatuseVisible, setIsStatusVisible] = useState(true);
 const [successMessage, setSuccessMessage] = useState('');
 const [selectedFile, setSelectedFile] = useState<File | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadResult, setUploadResult] = useState<any>(null);
 const [activeTab, setActiveTab] = useState('dashboard');
 const [loading, setLoading] = useState(true);
 const [dismissedMessages, setDismissedMessages] = useState<string[]>([]);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ firstName: '', lastName: '', email: '' });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'manage'>('add');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any>(null);
  const [editUserData, setEditUserData] = useState({ firstName: '', lastName: '', email: '' });
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Filter users for modal search
  const filteredModalUsers = useMemo(() => {
    if (!modalSearchTerm) return users;
    const searchLower = modalSearchTerm.toLowerCase();
    return users.filter(user => {
      const userName = (user.name || `${user.firstName || ''} ${user.lastName || ''}`).toLowerCase();
      const userEmail = (user.email || '').toLowerCase();
      return userName.includes(searchLower) || userEmail.includes(searchLower);
    });
  }, [users, modalSearchTerm]);

 // Fetch initial token visibility state
 useEffect(() => {
   fetch(`/api/users/coins?status=1`)
     .then(response => response.json())
     .then(data => setIsTokenBalanceVisible(data["status"] === "ON"))
     .catch(error => console.error('Error fetching token visibility:', error));
 }, []);

 // Fetch users and classes data
 useEffect(() => {
   const fetchData = async () => {
     setLoading(true);
     try {
       // Fetch users
       const usersResponse = await fetch(`/api/users`);
       const usersData = await usersResponse.json();

       const coinsData = await fetch(`/api/users/coins?all=1`);
       const coins = await coinsData.json();
       usersData.forEach(user => {
        let temp = coins.filter(item => item.user === user.email)
        if (temp.length > 0) {
          user.coins = temp[0]["coins"]
        } else {
          user.coins = 0;
        }
       });
       setUsers(usersData);

       try {
         // Fetch classes if endpoint exists
         const classesResponse = await fetch(`/api/classes`);
         if (classesResponse.ok) {
           const classesData = await classesResponse.json();
           setClasses([{ id: 0, name: 'כל הכיתות' }, ...classesData]);
         }
       } catch (classErr) {
         console.log('Classes endpoint not available yet');
       }
     } catch (err) {
       console.error('Error fetching users:', err);
       setError('Failed to fetch users');
     }

     try {
      const response = await fetch(`/api/admin/status` , {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      const data = await response.json();
      if (data["status"] === 'ON') {
        setIsStatusVisible(true);
      } else {
        setIsStatusVisible(false);
      }
    } catch (error) {
      setError('Failed to fetch status. Please try again.');
    } finally {
      setLoading(false);
    }
   };

   fetchData();
 }, []);

 const [searchTerm, setSearchTerm] = useState('');
 const [selectedClass, setSelectedClass] = useState(0); // 0 represents all classes
 const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
 const [actionType, setActionType] = useState<string>('');
 const [balanceAmount, setBalanceAmount] = useState<string>('');
 const router = useRouter();

 useEffect(() => {
   const storedUser = localStorage.getItem("currentUser");
   if (!storedUser) {
     router.push('/login');
     return;
   }

   const user = JSON.parse(storedUser);
  
   // For now using a placeholder check -needs to check if keeping it in a list version or a db version
   const adminEmails = ["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il", "r_admin@gmail.com"];
   const isAdmin = adminEmails.includes(user.email);
  
   if (!isAdmin) {
     setError('אין לך הרשאת גישה לממשק המנהל');
     setTimeout(() => {
       router.push('/login');
     }, 3000);
     return;
   }

   setCurrentUser(user.name);
 }, [router]);

 const updateCoinsStatus = (value) => {
  fetch(`/api/users/coins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ newStatus: value ? "ON" : "OFF"})
  });
 }

 const handleLogout = () => {
   localStorage.removeItem("currentUser");
   router.push('/');
 };

 const handleUploadExtraTime = async () => {
   if (!selectedFile) return;

   setIsUploading(true);
   setUploadResult(null);

   try {
     const formData = new FormData();
     formData.append('file', selectedFile);

     const response = await fetch('/api/admin/uploadExtraTime', {
       method: 'POST',
       body: formData,
     });

     const result = await response.json();

     if (!response.ok) {
       setUploadResult({
         success: false,
         message: result.error || 'שגיאה בהעלאת הקובץ',
         details: result.details
       });
     } else {
       setUploadResult({
         success: true,
         message: result.message,
         summary: result.summary
       });
       setSelectedFile(null);
     }
   } catch (error) {
     console.error('Error uploading extra time:', error);
     setUploadResult({
       success: false,
       message: 'שגיאה בהעלאת הקובץ'
     });
   } finally {
     setIsUploading(false);
   }
 };

 // Message handlers
 const handleSuccess = (message: string) => {
   setSuccessMessage(message);
   setTimeout(() => setSuccessMessage(''), 5000);
 };

 const handleError = (message: string) => {
   setError(message);
 };

 const dismissError = () => {
   setError('');
 };

 const dismissSuccess = () => {
   setSuccessMessage('');
 };

 const renderDashboard = () => (
   <ModernDashboard
     users={users}
     loading={loading}
     onSuccess={handleSuccess}
     onError={handleError}
     onNavigate={setActiveTab}
   />
 );

 const renderSystemSettings = () => (
   <div className={styles.settingsSection}>
     <div className={styles.sectionHeader}>
       <h2 className={styles.sectionTitle}>הגדרות מערכת</h2>
       <p className={styles.sectionDescription}>
         ניהול הגדרות מערכת, מטבעות וירטואליים ומצב מייקל
       </p>
     </div>

     <div className={styles.settingsGrid}>
       <EnhancedSettingsToggle
         title="הגדרות מערכת"
         icon={Shield}
         items={[
           {
             id: 'virtual-coins',
             label: 'מטבעות וירטואליים',
             description: 'הצג יתרת מטבעות למשתמשים במערכת',
             helpText: 'כאשר מופעל, משתמשים יכולים לראות את יתרת המטבעות שלהם ולקבל מטבעות עבור פעילויות. כאשר כבוי, המטבעות לא יוצגו בכלל.',
             checked: isTokenBalanceVisible,
             onChange: async (checked) => {
               setIsTokenBalanceVisible(checked);
               updateCoinsStatus(checked);
             }
           },
           {
             id: 'michael-ai',
             label: 'מייקל AI',
             description: 'הפעל או כבה את עוזר הבינה המלאכותית מייקל',
             helpText: 'מייקל הוא עוזר AI שעוזר לתלמידים ללמוד SQL. כאשר מופעל, התלמידים יכולים לשאול שאלות ולקבל עזרה. כאשר כבוי, מייקל לא יהיה זמין.',
             checked: isStatuseVisible,
             onChange: async (checked) => {
               setIsStatusVisible(checked);
               try {
                 await fetch(`/api/admin/status`, {
                   method: 'POST',
                   headers: {
                     'Content-Type': 'application/json',
                   },
                   body: JSON.stringify({ newStatus: checked ? "ON" : "OFF"})
                 });
               } catch (error) {
                 console.error('Error updating status:', error);
                 setError('שגיאה בעדכון סטטוס מייקל');
               }
             }
           }
         ]}
       />

       <div className={styles.settingCard}>
         <div className={styles.settingHeader}>
           <Clock size={20} />
           <span>התאמות זמן בחינה</span>
         </div>
         <div className={styles.extraTimeManagement}>
           <div className={styles.uploadInstructions}>
             <h4>הוראות העלאה:</h4>
             <ul>
               <li>הקובץ חייב להכיל עמודות: ID (מספר זהות) ו-PERCENTAGE (אחוז זמן נוסף)</li>
               <li>אחוז הזמן הנוסף חייב להיות בין 0 ל-100</li>
               <li>במקרה של כפילויות, הרשומה האחרונה תתקבל</li>
               <li>תמיכה בקבצי .xlsx ו-.csv</li>
             </ul>
           </div>
           
           <div className={styles.fileUploadSection}>
             <input
               type="file"
               accept=".xlsx,.csv"
               onChange={(e) => {
                 const file = e.target.files?.[0];
                 if (file) {
                   setSelectedFile(file);
                 }
               }}
               className={styles.fileInput}
               id="extraTimeFile"
             />
             <label htmlFor="extraTimeFile" className={styles.fileInputLabel}>
               <Upload size={16} />
               בחר קובץ Excel/CSV
             </label>
             {selectedFile && (
               <div className={styles.fileInfo}>
                 <span>📄 {selectedFile.name}</span>
                 <span>{(selectedFile.size / 1024).toFixed(1)} KB</span>
               </div>
             )}
           </div>
           
           <button
             onClick={handleUploadExtraTime}
             disabled={!selectedFile || isUploading}
             className={styles.uploadButton}
           >
             {isUploading ? 'מעלה...' : 'העלה התאמות זמן'}
           </button>
           
           {uploadResult && (
             <div className={`${styles.uploadResult} ${uploadResult.success ? styles.success : styles.error}`}>
               <div className={styles.uploadResultTitle}>
                 {uploadResult.success ? '✅ הצלחה' : '❌ שגיאה'}
               </div>
               <div className={styles.uploadResultMessage}>
                 {uploadResult.message}
               </div>
               {uploadResult.summary && (
                 <div className={styles.uploadSummary}>
                  <div>סה&quot;כ רשומות: {uploadResult.summary.totalRecords}</div>
                   <div>נוספו: {uploadResult.summary.inserted}</div>
                   <div>עודכנו: {uploadResult.summary.updated}</div>
                   <div>שגיאות: {uploadResult.summary.errors}</div>
                 </div>
               )}
             </div>
           )}
         </div>
       </div>
     </div>
   </div>
 );

 const handleAddUser = async () => {
   if (!newUser.firstName || !newUser.lastName || !newUser.email) {
     handleError('יש למלא את כל השדות');
     return;
   }

   setIsCreatingUser(true);
   try {
     const response = await fetch('/api/users', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         firstName: newUser.firstName,
         lastName: newUser.lastName,
         email: newUser.email,
         password: 'shenkar',
         isFirst: true
       }),
     });

     const result = await response.json();

     if (!response.ok) {
       handleError(result.error || 'שגיאה ביצירת משתמש');
       return;
     }

     handleSuccess('המשתמש נוצר בהצלחה!');
     setIsAddUserModalOpen(false);
     setNewUser({ firstName: '', lastName: '', email: '' });
     setModalMode('add');
     // Refresh users data
     fetchUsersData();
   } catch (error) {
     console.error('Error creating user:', error);
     handleError('שגיאה ביצירת משתמש');
   } finally {
     setIsCreatingUser(false);
   }
 };

const handleSelectUser = (user: any) => {
  setSelectedUserForEdit(user);
  setModalSearchTerm(''); // Clear search when selecting a user
  
  // Parse name if firstName/lastName are not available
  let firstName = user.firstName || '';
  let lastName = user.lastName || '';
  
  if (!firstName && !lastName && user.name) {
    const nameParts = user.name.trim().split(/\s+/);
    if (nameParts.length >= 2) {
      firstName = nameParts[0];
      lastName = nameParts.slice(1).join(' ');
    } else {
      firstName = user.name;
      lastName = '';
    }
  }
  
  setEditUserData({
    firstName,
    lastName,
    email: user.email || ''
  });
};

 const handleResetPassword = async () => {
   if (!selectedUserForEdit) return;

   setIsResettingPassword(true);
   try {
     const response = await fetch(`/api/users/${encodeURIComponent(selectedUserForEdit.email)}`, {
       method: 'PUT',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({ password: 'shenkar' }),
     });

     const result = await response.json();

     if (!response.ok) {
       handleError(result.error || 'שגיאה באיפוס סיסמה');
       return;
     }

     handleSuccess('הסיסמה אופסה בהצלחה ל-"shenkar"');
     fetchUsersData();
   } catch (error) {
     console.error('Error resetting password:', error);
     handleError('שגיאה באיפוס סיסמה');
   } finally {
     setIsResettingPassword(false);
   }
 };

 const handleUpdateUser = async () => {
   if (!selectedUserForEdit || !editUserData.firstName || !editUserData.lastName || !editUserData.email) {
     handleError('יש למלא את כל השדות');
     return;
   }

   setIsUpdatingUser(true);
   try {
     const response = await fetch(`/api/users/${encodeURIComponent(selectedUserForEdit.email)}`, {
       method: 'PUT',
       headers: {
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         firstName: editUserData.firstName,
         lastName: editUserData.lastName,
         email: editUserData.email
       }),
     });

     const result = await response.json();

     if (!response.ok) {
       handleError(result.error || 'שגיאה בעדכון משתמש');
       return;
     }

     handleSuccess('פרטי המשתמש עודכנו בהצלחה!');
     setSelectedUserForEdit(null);
     setEditUserData({ firstName: '', lastName: '', email: '' });
     fetchUsersData();
   } catch (error) {
     console.error('Error updating user:', error);
     handleError('שגיאה בעדכון משתמש');
   } finally {
     setIsUpdatingUser(false);
   }
 };

 const renderUserManagement = () => (
   <div className={styles.userManagementSection}>
     <div className={styles.sectionHeader}>
       <div className={styles.sectionHeaderRow}>
         <h2 className={styles.sectionTitle}>ניהול משתמשים</h2>
         <button
           className={styles.addUserButton}
           onClick={() => setIsAddUserModalOpen(true)}
         >
           <Plus size={18} />
           <span> ערוך / הוסף  </span>
         </button>
       </div>
       <p className={styles.sectionDescription}>
         ניהול משתמשים, יתרות מטבעות ופעולות מרובות
       </p>
     </div>

     <div className={styles.controlsContainer}>
       {selectedUsers.length > 0 && (
         <BulkActions
           selectedUsers={selectedUsers}
           onSuccess={() => {
             handleSuccess('הפעולה בוצעה בהצלחה!');
             setSelectedUsers([]);
             // Refresh users data
             fetchUsersData();
           }}
           onError={handleError}
         />
       )}
       
       <SearchBar
         searchTerm={searchTerm}
         onSearchChange={setSearchTerm}
         selectedClass={selectedClass}
         onClassChange={setSelectedClass}
         classes={classes}
       />

       <UsersList
         users={users}
         searchTerm={searchTerm}
         selectedClass={selectedClass}
         selectedUsers={selectedUsers}
         onSelectionChange={setSelectedUsers}
         loading={loading}
       />
     </div>

     {/* Add/Manage User Modal */}
     {isAddUserModalOpen && (
       <div className={styles.modalOverlay} onClick={() => {
         setIsAddUserModalOpen(false);
         setModalMode('add');
         setSelectedUserForEdit(null);
         setEditUserData({ firstName: '', lastName: '', email: '' });
         setModalSearchTerm('');
       }}>
         <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
           <div className={styles.modalHeader}>
             <h3 className={styles.modalTitle}>ניהול משתמשים</h3>
             <button
               className={styles.modalCloseButton}
               onClick={() => {
                 setIsAddUserModalOpen(false);
                 setModalMode('add');
                 setSelectedUserForEdit(null);
                 setEditUserData({ firstName: '', lastName: '', email: '' });
                 setModalSearchTerm('');
               }}
             >
               <X size={20} />
             </button>
           </div>
           
           {/* Mode Tabs */}
           <div className={styles.modalTabs}>
             <button
               className={`${styles.modalTab} ${modalMode === 'add' ? styles.modalTabActive : ''}`}
               onClick={() => {
                 setModalMode('add');
                 setSelectedUserForEdit(null);
                 setEditUserData({ firstName: '', lastName: '', email: '' });
                 setModalSearchTerm('');
               }}
             >
               הוסף משתמש חדש
             </button>
             <button
               className={`${styles.modalTab} ${modalMode === 'manage' ? styles.modalTabActive : ''}`}
               onClick={() => setModalMode('manage')}
             >
               נהל משתמש קיים
             </button>
           </div>
           
           <div className={styles.modalBody}>
             {modalMode === 'add' ? (
               <>
                 <div className={styles.formGroup}>
                   <label className={styles.formLabel}>שם פרטי *</label>
                   <input
                     type="text"
                     className={styles.formInput}
                     value={newUser.firstName}
                     onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                     placeholder="הכנס שם פרטי"
                     dir="rtl"
                   />
                 </div>
                 
                 <div className={styles.formGroup}>
                   <label className={styles.formLabel}>שם משפחה *</label>
                   <input
                     type="text"
                     className={styles.formInput}
                     value={newUser.lastName}
                     onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                     placeholder="הכנס שם משפחה"
                     dir="rtl"
                   />
                 </div>
                 
                 <div className={styles.formGroup}>
                   <label className={styles.formLabel}>אימייל *</label>
                   <input
                     type="email"
                     className={styles.formInput}
                     value={newUser.email}
                     onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                     placeholder="הכנס כתובת אימייל"
                     dir="ltr"
                   />
                 </div>
                 
                 <div className={styles.formInfo}>
                   <p>ערכי ברירת מחדל:</p>
                   <ul>
                     <li>סיסמה: shenkar</li>
                     <li>isFirst: true</li>
                   </ul>
                 </div>
               </>
             ) : (
               <>
                 {!selectedUserForEdit ? (
                   <div className={styles.usersListModal} key="user-list">
                     <h4 className={styles.usersListTitle}>בחר משתמש לעריכה:</h4>
                     <div className={styles.modalSearchContainer}>
                       <Search size={18} className={styles.modalSearchIcon} />
                       <input
                         type="text"
                         className={styles.modalSearchInput}
                         placeholder="חפש לפי שם או אימייל..."
                         value={modalSearchTerm}
                         onChange={(e) => setModalSearchTerm(e.target.value)}
                         dir="rtl"
                       />
                     </div>
                     <div className={styles.usersListContainer}>
                       {filteredModalUsers.length > 0 ? (
                         filteredModalUsers.map(user => (
                           <div
                             key={user.email}
                             className={styles.userListItem}
                             onClick={(e) => {
                               e.stopPropagation();
                               handleSelectUser(user);
                             }}
                           >
                             <div className={styles.userListItemInfo}>
                               <div className={styles.userListItemName}>{user.name || `${user.firstName || ''} ${user.lastName || ''}`}</div>
                               <div className={styles.userListItemEmail}>{user.email}</div>
                             </div>
                           </div>
                         ))
                       ) : modalSearchTerm ? (
                         <div className={styles.modalNoResults}>
                           לא נמצאו משתמשים התואמים לחיפוש
                         </div>
                       ) : null}
                     </div>
                   </div>
                 ) : (
                   <div className={styles.editUserSection} key={`edit-${selectedUserForEdit?.email || 'user'}`}>
                     <div className={styles.editUserHeader}>
                       <h4>ערוך משתמש: {selectedUserForEdit.name || selectedUserForEdit.email}</h4>
                       <button
                         className={styles.backButton}
                         onClick={() => {
                           setSelectedUserForEdit(null);
                           setEditUserData({ firstName: '', lastName: '', email: '' });
                           setModalSearchTerm('');
                         }}
                       >
                         חזור לרשימה
                       </button>
                     </div>
                     
                     <div className={styles.formGroup}>
                       <label className={styles.formLabel}>שם פרטי *</label>
                       <input
                         type="text"
                         className={styles.formInput}
                         value={editUserData.firstName}
                         onChange={(e) => setEditUserData({ ...editUserData, firstName: e.target.value })}
                         placeholder="הכנס שם פרטי"
                         dir="rtl"
                       />
                     </div>
                     
                     <div className={styles.formGroup}>
                       <label className={styles.formLabel}>שם משפחה *</label>
                       <input
                         type="text"
                         className={styles.formInput}
                         value={editUserData.lastName}
                         onChange={(e) => setEditUserData({ ...editUserData, lastName: e.target.value })}
                         placeholder="הכנס שם משפחה"
                         dir="rtl"
                       />
                     </div>
                     
                     <div className={styles.formGroup}>
                       <label className={styles.formLabel}>אימייל *</label>
                       <input
                         type="email"
                         className={styles.formInput}
                         value={editUserData.email}
                         onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                         placeholder="הכנס כתובת אימייל"
                         dir="ltr"
                       />
                     </div>
                     
                     <div className={styles.userActions}>
                       <button
                         className={styles.resetPasswordButton}
                         onClick={handleResetPassword}
                         disabled={isResettingPassword}
                       >
                         {isResettingPassword ? 'מאפס...' : 'איפוס סיסמה ל-"shenkar"'}
                       </button>
                     </div>
                   </div>
                 )}
               </>
             )}
           </div>
           
           <div className={styles.modalFooter}>
             <button
               className={styles.modalCancelButton}
               onClick={() => {
                 setIsAddUserModalOpen(false);
                 setModalMode('add');
                 setSelectedUserForEdit(null);
                 setEditUserData({ firstName: '', lastName: '', email: '' });
                 setModalSearchTerm('');
               }}
               disabled={isCreatingUser || isUpdatingUser}
             >
               ביטול
             </button>
             {modalMode === 'add' ? (
               <button
                 className={styles.modalSubmitButton}
                 onClick={handleAddUser}
                 disabled={isCreatingUser || !newUser.firstName || !newUser.lastName || !newUser.email}
               >
                 {isCreatingUser ? 'יוצר...' : 'צור משתמש'}
               </button>
             ) : selectedUserForEdit ? (
               <button
                 className={styles.modalSubmitButton}
                 onClick={handleUpdateUser}
                 disabled={isUpdatingUser || !editUserData.firstName || !editUserData.lastName || !editUserData.email}
               >
                 {isUpdatingUser ? 'מעדכן...' : 'שמור שינויים'}
               </button>
             ) : null}
           </div>
         </div>
       </div>
     )}
   </div>
 );

 // Helper function to refresh users data
 const fetchUsersData = async () => {
   try {
     const usersResponse = await fetch(`/api/users`);
     const usersData = await usersResponse.json();
     
     const coinsData = await fetch(`/api/users/coins?all=1`);
     const coins = await coinsData.json();
     usersData.forEach(user => {
      let temp = coins.filter(item => item.user === user.email)
      if (temp.length > 0) {
        user.coins = temp[0]["coins"]
      } else {
        user.coins = 0;
      }
     });
     setUsers(usersData);
   } catch (err) {
     console.error('Error fetching users:', err);
     setError('שגיאה בטעינת נתוני משתמשים');
   }
 };

 return error && !dismissedMessages.includes('main-error') ? (
   <div className={styles.adminContainer}>
     <ErrorBanner
       message="שגיאה בגישה למערכת הניהול"
       details={error}
       type="error"
       retryable
       dismissible
       onRetry={() => window.location.reload()}
       onDismiss={() => {
         setDismissedMessages(['main-error']);
         setError('');
       }}
     />
   </div>
 ) : (
   <ModernAdminLayout
     activeTab={activeTab}
     onTabChange={setActiveTab}
     currentUser={currentUser}
     onLogout={handleLogout}
   >
     {/* Success/Error Messages */}
     {successMessage && (
       <ErrorBanner
         message={successMessage}
         type="info"
         dismissible
         onDismiss={dismissSuccess}
       />
     )}
     
     {error && (
       <ErrorBanner
         message="שגיאה במערכת"
         details={error}
         type="error"
         retryable
         dismissible
         onRetry={() => window.location.reload()}
         onDismiss={dismissError}
       />
     )}

    {/* Tab Content */}
    {activeTab === 'dashboard' && renderDashboard()}
    {activeTab === 'settings' && renderSystemSettings()}
    {activeTab === 'users' && renderUserManagement()}
    {activeTab === 'students' && <StudentProfiles />}
    {activeTab === 'analysis' && <AnalysisManagement />}
   </ModernAdminLayout>
 );
};
export default AdminPage;
