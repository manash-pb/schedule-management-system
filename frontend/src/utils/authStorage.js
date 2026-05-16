export const setAuthData = (data, remember) => {
    const storage = remember ? localStorage : sessionStorage;
    
    // Clear both first to avoid stale data
    clearAuthData();
    
    if (data.isAdminLoggedIn !== undefined) storage.setItem('isAdminLoggedIn', data.isAdminLoggedIn);
    if (data.userRole) storage.setItem('userRole', data.userRole);
    if (data.token) storage.setItem('token', data.token);
    if (data.userEmail) storage.setItem('userEmail', data.userEmail);
    if (data.userName) storage.setItem('userName', data.userName);
    if (data.userPicture) storage.setItem('userPicture', data.userPicture);
};

export const getAuthData = (key) => {
    return sessionStorage.getItem(key) || localStorage.getItem(key);
};

export const clearAuthData = () => {
    const keys = ['isAdminLoggedIn', 'userRole', 'token', 'userEmail', 'userName', 'userPicture', 'authToken'];
    keys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    });
};
