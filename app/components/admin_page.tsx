"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Users, Settings, BarChart3, FileText, Search, Upload, ToggleLeft, Shield, Clock, Award, Database } from 'lucide-react';
import styles from './admin_page.module.css';
import config from '../config';

const SERVER_BASE = config.serverUrl;

const options = {
  'add_balance': 'הוסף מטבעות',
  'reduce_balance': 'הפחת מטבעות',
  'reset_password': 'איפוס סיסמה'
}

const AdminPage: React.FC = () => {
 const [currentUser, setCurrentUser] = useState(null);
 const [error, setError] = useState('');
 const [users, setUsers] = useState([]);
 const [classes, setClasses] = useState([{ id: 0, name: 'All classes' }]);
 const [isTokenBalanceVisible, setIsTokenBalanceVisible] = useState(true);
 const [isStatuseVisible, setIsStatusVisible] = useState(true);
 const [successMessage, setSuccessMessage] = useState('');
 const [selectedFile, setSelectedFile] = useState<File | null>(null);
 const [isUploading, setIsUploading] = useState(false);
 const [uploadResult, setUploadResult] = useState<any>(null);
 const [activeTab, setActiveTab] = useState('dashboard');

 // Fetch initial token visibility state
 useEffect(() => {
   fetch(`${SERVER_BASE}/getCoinsStatus`)
     .then(response => response.json())
     .then(data => setIsTokenBalanceVisible(data["status"] === "ON"))
     .catch(error => console.error('Error fetching token visibility:', error));
 }, []);

 // Fetch users and classes data
 useEffect(() => {
   const fetchData = async () => {
     try {
       // Fetch users
       const usersResponse = await fetch(`${SERVER_BASE}/allUsers`);
       const usersData = await usersResponse.json();

       const coinsData = await fetch(`${SERVER_BASE}/getAllCoins`);
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
         // Fetch classes if endpoint exists-- needs to add classes column to the users table
         const classesResponse = await fetch(`${SERVER_BASE}/classes`);
         if (classesResponse.ok) {
           const classesData = await classesResponse.json();
           setClasses([{ id: 0, name: 'כל הכיתות' }, ...classesData]);
         }
       } catch (classErr) {
         console.log('Classes endpoint not available yet');
         // Continue with default class only
       }
     } catch (err) {
       console.error('Error fetching users:', err);
       setError('Failed to fetch users');
     }

     try {
      const response = await fetch(SERVER_BASE + "/getStatus" , {
        method: 'GET',
        mode: 'cors',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
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
  fetch(`${SERVER_BASE}/setCoinsStatus`, {
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

 const renderDashboard = () => (
   <div className={styles.dashboardSection}>
     <div className={styles.statsGrid}>
       <div className={styles.statCard}>
         <div className={styles.statIcon}>
           <Users size={24} />
         </div>
         <div className={styles.statContent}>
           <div className={styles.statNumber}>{users.length}</div>
           <div className={styles.statLabel}>משתמשים רשומים</div>
         </div>
       </div>
       
       <div className={styles.statCard}>
         <div className={styles.statIcon}>
           <Database size={24} />
         </div>
         <div className={styles.statContent}>
           <div className={styles.statNumber}>{classes.length - 1}</div>
           <div className={styles.statLabel}>כיתות</div>
         </div>
       </div>
       
       <div className={styles.statCard}>
         <div className={styles.statIcon}>
           <Award size={24} />
         </div>
         <div className={styles.statContent}>
           <div className={styles.statNumber}>
             {users.reduce((sum, user) => sum + (user.coins || 0), 0)}
           </div>
           <div className={styles.statLabel}>מטבעות סה"כ</div>
         </div>
       </div>
     </div>

     <div className={styles.quickActions}>
       <h3 className={styles.sectionTitle}>פעולות מהירות</h3>
       <div className={styles.actionButtons}>
         <button
           onClick={() => router.push('/admin/questions')}
           className={styles.quickActionButton}
         >
           <FileText size={20} />
           <span>אישור שאלות</span>
         </button>
         
         <button
           onClick={() => router.push('/admin/exam-grading')}
           className={styles.quickActionButton}
         >
           <Award size={20} />
           <span>בדיקה וציונים</span>
         </button>
       </div>
     </div>
   </div>
 );

 const renderSystemSettings = () => (
   <div className={styles.settingsSection}>
     <div className={styles.settingsGrid}>
       <div className={styles.settingCard}>
         <div className={styles.settingHeader}>
           <Shield size={20} />
           <span>הגדרות מערכת</span>
         </div>
         <div className={styles.togglesContainer}>
           <div className={styles.toggleItem}>
             <label>
               <span>מטבעות וירטואלים</span>
               <div className={styles.toggle}>
                 <input
                   type="checkbox"
                   checked={isTokenBalanceVisible}
                   onChange={async (e) => {
                     const newValue = e.target.checked;
                     setIsTokenBalanceVisible(newValue);
                     updateCoinsStatus(newValue)
                   }}
                 />
                 <div className={styles.slider}>
                   <span className={styles.on}></span>
                   <span className={styles.off}></span>
                 </div>
               </div>
             </label>
           </div>
           <div className={styles.toggleItem}>
             <label>
               <span>מייקל</span>
               <div className={styles.toggle}>
                 <input
                   type="checkbox"
                   checked={isStatuseVisible}
                   onChange={async (e) => {
                     const newValue = e.target.checked;
                     setIsStatusVisible(newValue);
                     try {
                       await fetch(`${SERVER_BASE}/setStatus`, {
                         method: 'POST',
                         headers: {
                           'Content-Type': 'application/json',
                         },
                         body: JSON.stringify({ newStatus: newValue ? "ON" : "OFF"})
                       });
                     } catch (error) {
                       console.error('Error updating status:', error);
                     }
                   }}
                 />
                 <div className={styles.slider}>
                   <span className={styles.on}></span>
                   <span className={styles.off}></span>
                 </div>
               </div>
             </label>
           </div>
         </div>
       </div>

       <div className={styles.settingCard}>
         <div className={styles.settingHeader}>
           <Clock size={20} />
           <span>התאמות זמן בחינה</span>
         </div>
         <div className={styles.extraTimeManagement}>
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
                   <div>סה"כ רשומות: {uploadResult.summary.totalRecords}</div>
                   <div>נוספו: {uploadResult.summary.inserted}</div>
                   <div>עודכנו: {uploadResult.summary.updated}</div>
                   <div>שגיאות: {uploadResult.summary.errors}</div>
                 </div>
               )}
             </div>
           )}
           <div className={styles.uploadInstructions}>
             <h4>הוראות:</h4>
             <ul>
               <li>הקובץ חייב להכיל עמודות: ID (מספר זהות) ו-PERCENTAGE (אחוז זמן נוסף)</li>
               <li>אחוז הזמן הנוסף חייב להיות בין 0 ל-100</li>
               <li>במקרה של כפילויות, הרשומה האחרונה תתקבל</li>
               <li>תמיכה בקבצי .xlsx ו-.csv</li>
             </ul>
           </div>
         </div>
       </div>
     </div>
   </div>
 );

 const renderUserManagement = () => (
   <div className={styles.userManagementSection}>
     {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
     
     <div className={styles.controlsContainer}>
       {selectedUsers.length > 0 && (
         <div className={styles.bulkActions}>
           <div className={styles.bulkActionsHeader}>
             <span>פעולות על {selectedUsers.length} משתמשים נבחרים:</span>
           </div>
           <div className={styles.bulkActionsControls}>
             <select
               value={actionType}
               onChange={(e) => setActionType(e.target.value)}
               className={styles.actionSelect}
             >
               <option value="">בחר אפשרות</option>
               {Object.keys(options).map(option => (
                 <option key={option} value={option}>
                   {options[option]}
                 </option>
               ))}
             </select>
            
             {Object.keys(options).includes(actionType) && (
               <input
                 type="number"
                 value={balanceAmount}
                 onChange={(e) => setBalanceAmount(e.target.value)}
                 placeholder="כמות"
                 className={styles.balanceInput}
               />
             )}

             <button
               onClick={async () => {
                 try {
                   if (!actionType) {
                     setError('Please select an action');
                     return;
                   }
                   if (['add_balance', 'reduce_balance', 'set_balance'].includes(actionType) && !balanceAmount) {
                     setError('Please enter an amount');
                     return;
                   }

                   if (actionType === "reset_password") {
                    await fetch(SERVER_BASE + '/updatePasswordToMany', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ emails: selectedUsers})
                   })
                  } else {

                   // Prepare the request body with the single action
                   const requestBody = {
                     users: selectedUsers,
                     type: actionType,
                     amount: parseInt(balanceAmount)
                   };

                   // Send request to server with multiple actions
                   const response = await fetch(SERVER_BASE + '/admin/changeBalance', {
                     method: 'POST',
                     headers: {
                       'Content-Type': 'application/json',
                     },
                     body: JSON.stringify(requestBody)
                   });

                   if (!response.ok) {
                     const errorData = await response.json();
                     throw new Error(errorData.error || 'Failed to perform bulk action');
                   }
                   }

                   // Refresh users data after successful action
                   const usersResponse = await fetch(`${SERVER_BASE}/allUsers`);
                   const usersData = await usersResponse.json();
                   setUsers(usersData);

                   // Reset form and clear any previous errors
                   setError('');
                   setActionType('');
                   setBalanceAmount('');
                   setSelectedUsers([]);
                   setSuccessMessage('הפעולה בוצעה בהצלחה! ✅');
                   setTimeout(() => setSuccessMessage(''), 3000);
                 } catch (err) {
                   console.error('Error performing bulk action:', err);
                   setError('Failed to perform action');
                 }
               }}
               className={styles.actionButton}
               disabled={!actionType}
             >
               אישור
             </button>
           </div>
         </div>
       )}
      
       <div className={styles.searchContainer}>
         <div className={styles.searchHeader}>
           <Search size={20} />
           <input
             type="text"
             placeholder="הכנס מילות חיפוש..."
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className={styles.searchInput}
           />
         </div>
       </div>

       <div className={styles.usersContainer}>
         <div className={styles.usersHeader}>
           <label className={styles.selectAllContainer}>
             <input
               type="checkbox"
               checked={selectedUsers.length === users.filter(user =>
                 (selectedClass === 0 || user.classId === selectedClass) &&
                 (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                 user.email.toLowerCase().includes(searchTerm.toLowerCase()))
               ).length}
               onChange={(e) => {
                 const filteredUsers = users.filter(user =>
                   (selectedClass === 0 || user.classId === selectedClass) &&
                   (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   user.email.toLowerCase().includes(searchTerm.toLowerCase()))
                 );
                 setSelectedUsers(e.target.checked ? filteredUsers.map(u => u.email) : []);
               }}
             />
             בחר הכל
           </label>
         </div>
         <div className={styles.usersList}>
           {(() => {
             const filteredUsers = users.filter(user =>
               (selectedClass === 0 || user.classId === selectedClass) &&
               (user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
               user.email.toLowerCase().includes(searchTerm.toLowerCase()))
             );

             if (filteredUsers.length === 0) {
               return (
                 <div className={styles.noResults}>
                   <div className={styles.noResultsIcon}>🔍</div>
                   <div className={styles.noResultsText}>
                     {searchTerm ? 'לא נמצאו תוצאות עבור החיפוש' : 'אין משתמשים להצגה'}
                   </div>
                   {searchTerm && (
                     <div className={styles.noResultsSubtext}>
                       נסה לחפש במילות חיפוש אחרות
                     </div>
                   )}
                 </div>
               );
             }

             return filteredUsers.map(user => (
               <div key={user.id} className={styles.userCard}>
                 <div className={styles.userInfo}>
                   <div className={styles.userName}>{user.name || user.firstName}</div>
                   <div className={styles.userEmail}>{user.email}</div>
                 </div>
                 <div className={styles.leftSection}>
                   <div className={styles.userBalance}>
                     <span className={styles.balanceLabel}>יתרה:</span>
                     <span className={styles.balanceValue}>{user.coins}</span>
                   </div>
                   <input
                     type="checkbox"
                     checked={selectedUsers.includes(user.email)}
                     onChange={(e) => {
                       setSelectedUsers(prev =>
                         e.target.checked
                           ? [...prev, user.email]
                           : prev.filter(email => email !== user.email)
                       );
                     }}
                     className={styles.userCheckbox}
                   />
                 </div>
               </div>
             ));
           })()}
         </div>
       </div>
     </div>
   </div>
 );

 return error ? (
   <div className={styles.adminContainer}>
     <div className={styles.errorMessage}>{error}</div>
   </div>
 ) : (
   <div className={styles.adminContainer}>
     {/* Sticky Navigation Header */}
     <div className={styles.stickyNav}>
       <div className={styles.navContent}>
         <div className={styles.navLeft}>
           <button 
             onClick={handleLogout}
             className={styles.logoutButton}
           >
             <LogOut size={20} />
             יציאה
           </button>
         </div>
         <div className={styles.navCenter}>
           <BarChart3 size={24} />
           <h1 className={styles.navTitle}>ממשק ניהול - Michael AI</h1>
         </div>
         <div className={styles.navRight}>
           <div className={styles.userWelcome}>
             <Users size={18} />
             היי {currentUser}
           </div>
         </div>
       </div>
     </div>

     {/* Main Content */}
     <div className={styles.mainContent}>
       {/* Tab Navigation */}
       <div className={styles.tabNavigation}>
         <button
           className={`${styles.tabButton} ${activeTab === 'dashboard' ? styles.activeTab : ''}`}
           onClick={() => setActiveTab('dashboard')}
         >
           <BarChart3 size={18} />
           <span>דשבורד</span>
         </button>
         <button
           className={`${styles.tabButton} ${activeTab === 'settings' ? styles.activeTab : ''}`}
           onClick={() => setActiveTab('settings')}
         >
           <Settings size={18} />
           <span>הגדרות</span>
         </button>
         <button
           className={`${styles.tabButton} ${activeTab === 'users' ? styles.activeTab : ''}`}
           onClick={() => setActiveTab('users')}
         >
           <Users size={18} />
           <span>ניהול משתמשים</span>
         </button>
       </div>

       {/* Tab Content */}
       <div className={styles.tabContent}>
         {activeTab === 'dashboard' && renderDashboard()}
         {activeTab === 'settings' && renderSystemSettings()}
         {activeTab === 'users' && renderUserManagement()}
       </div>
     </div>
   </div>
 );
};
export default AdminPage;



