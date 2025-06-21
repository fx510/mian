/**
 * SQL Explorer for File Manager
 * Frontend JavaScript implementation
 */

// Debug function to log messages to console
function sqlDebugLog(message, data = null) {
    const timestamp = new Date().toISOString();
    if (data) {
        console.log(`[SQL Explorer ${timestamp}] ${message}`, data);
    } else {
        console.log(`[SQL Explorer ${timestamp}] ${message}`);
    }
}

// Initialize SQL Explorer when the tab is selected
function initSQLExplorer() {
    sqlDebugLog('Initializing SQL Explorer');
    
    // Cache DOM elements
    const connectionForm = document.getElementById('sqlConnectionForm');
    const databaseSelect = document.getElementById('sqlDatabaseSelect');
    const tableFilter = document.getElementById('sqlTableFilter');
    const tableStructureContainer = document.getElementById('sqlTableStructure');
    const tableDataContainer = document.getElementById('sqlTableData');
    const sqlQueryInput = document.getElementById('sqlQueryInput');
    const sqlQueryButton = document.getElementById('sqlExecuteQuery');
    const sqlQueryResult = document.getElementById('sqlQueryResult');
    const sqlExportSql = document.getElementById('sqlExportSql');
    const sqlExportCsv = document.getElementById('sqlExportCsv');
    const sqlExportZip = document.getElementById('sqlExportZip');
    const sqlGlobalSearchInput = document.getElementById('sqlGlobalSearch');
    const sqlGlobalSearchButton = document.getElementById('sqlGlobalSearchBtn');
    
    // Add connection form event listener
    if (connectionForm) {
        connectionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            connectToDatabase();
        });
    }
    
    // Add database selection event listener
    if (databaseSelect) {
        databaseSelect.addEventListener('change', function(e) {
            const selectedDb = e.target.value;
            if (selectedDb) {
                loadTables(selectedDb);
            }
        });
    }
    
    // Add query execution event listener
    if (sqlQueryButton) {
        sqlQueryButton.addEventListener('click', function() {
            executeQuery();
        });
    }
    
    // If we have the query input, also add Ctrl+Enter shortcut
    if (sqlQueryInput) {
        sqlQueryInput.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                executeQuery();
            }
        });
    }
    
    // Add export button event listeners
    if (sqlExportSql) {
        sqlExportSql.addEventListener('click', function() {
            exportTableAsSql();
        });
    }
    
    if (sqlExportCsv) {
        sqlExportCsv.addEventListener('click', function() {
            exportTableAsCsv();
        });
    }
    
    if (sqlExportZip) {
        sqlExportZip.addEventListener('click', function() {
            exportDatabaseAsZip();
        });
    }
    
    // Add export all databases button event listener
    const sqlExportAllZip = document.getElementById('sqlExportAllZip');
    if (sqlExportAllZip) {
        sqlExportAllZip.addEventListener('click', function() {
            exportAllDatabasesAsZip();
        });
    }
    
    // Add global search event listeners
    if (sqlGlobalSearchButton) {
        sqlGlobalSearchButton.addEventListener('click', function() {
            const searchQuery = sqlGlobalSearchInput ? sqlGlobalSearchInput.value.trim() : '';
            globalDatabaseSearch(searchQuery);
        });
    }
    
    if (sqlGlobalSearchInput) {
        sqlGlobalSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchQuery = this.value.trim();
                globalDatabaseSearch(searchQuery);
            }
        });
    }
}

/**
 * Get CSRF token from cookies
 */
function getCsrfToken() {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i].trim();
        if (cookie.startsWith('csrf_token=')) {
            sqlDebugLog('Found CSRF token in cookies');
            return cookie.substring('csrf_token='.length, cookie.length);
        }
    }
    sqlDebugLog('CSRF token not found in cookies!');
    return '';
}

// --- Encryption/Decryption helpers (copied from utils.js if not present) ---
if (typeof encrypt !== 'function') {
    function encrypt(message, key) {
        return CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(message), key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        }).toString();
    }
}
if (typeof decrypt !== 'function') {
    function decrypt(encryptedMessage, key) {
        return CryptoJS.AES.decrypt(encryptedMessage, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        }).toString(CryptoJS.enc.Utf8);
    }
}
// ... existing code ...

/**
 * Custom sendRequest function for SQL Explorer
 */
function sqlSendRequest(data) {
    sqlDebugLog('Sending SQL request', data);
    // --- Encryption logic ---
    const isEnc = (window.phpVars && window.phpVars.isEnc === '1');
    const encryptionKey = window.phpVars ? window.phpVars.encryptionKey : null;
    let jsonData = JSON.stringify(data);
    const encryptedData = isEnc ? encrypt(jsonData, CryptoJS.enc.Utf8.parse(encryptionKey)) : jsonData;
    // ... existing code ...
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', window.location.href, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        sqlDebugLog('SQL response received', xhr.responseText);
                        // --- Decryption logic ---
                        const decrypted = isEnc ? decrypt(xhr.responseText, CryptoJS.enc.Utf8.parse(encryptionKey)) : xhr.responseText;
                        const response = JSON.parse(decrypted);
                        sqlDebugLog('SQL response parsed', response);
                        resolve(response);
                    } catch (error) {
                        const errorMsg = 'Failed to parse response: ' + error.message;
                        sqlDebugLog('SQL parse error', errorMsg);
                        reject(errorMsg);
                    }
                } else {
                    const errorMsg = 'Request failed with status: ' + xhr.status;
                    sqlDebugLog('SQL request failed', errorMsg);
                    reject(errorMsg);
                }
            }
        };
        xhr.onerror = function() {
            const errorMsg = 'Network error occurred';
            sqlDebugLog('SQL network error', errorMsg);
            reject(errorMsg);
        };
        xhr.send(encryptedData);
    });
}

/**
 * Connect to database with form values
 */
function connectToDatabase() {
    sqlDebugLog('Connecting to database...');
    
    // Clear UI state
    clearDatabaseSelect();
    clearTableSelect();
    clearTableData();
    clearQueryResult();
    
    // Get form values
    const host = document.getElementById('sqlHost').value || 'localhost';
    const user = document.getElementById('sqlUser').value;
    const password = document.getElementById('sqlPassword').value;
    const database = document.getElementById('sqlDatabase').value;
    const port = document.getElementById('sqlPort').value || '3306';
    
    sqlDebugLog('Connection parameters', { host, user, database, port });
    
    // Show loading state
    showLoadingState('Connecting to database...');
    
    // Get CSRF token
    const csrfToken = getCsrfToken();
    sqlDebugLog('Using CSRF token', csrfToken);
    
    // Send connection request
    const data = {
        csrf: csrfToken,
        action: 'sql_explorer',
        sql_action: 'connect',
        params: {
            host: host,
            user: user, 
            password: password,
            database: database,
            port: port
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Connection result', result);
            
            if (result.success) {
                // Show success message
                triggerAlert('success', 'Connected to database successfully!');
                
                // Hide connection form
                hideConnectionForm();
                
                // Show and setup the logout button
                const logoutBtn = document.getElementById('sqlLogoutBtn');
                if (logoutBtn) {
                    logoutBtn.classList.remove('hidden');
                    logoutBtn.addEventListener('click', disconnectDatabase);
                }
                
                // Load databases if connection was successful
                loadDatabases();
                enableDatabaseSection();
                
                // If a specific database was provided, select it
                if (database) {
                    selectDatabase(database);
                }
            } else {
                // Show error message
                triggerAlert('warning', 'Connection failed: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Connection error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Disconnect from database
 */
function disconnectDatabase() {
    sqlDebugLog('Disconnecting from database...');
    
    // Show loading state
    showLoadingState('Disconnecting...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'disconnect',
        params: {}
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Disconnection result', result);
            
            // Reset UI without page reload
            resetUIAfterDisconnect();
            
            triggerAlert('success', 'Disconnected from database successfully!');
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Disconnection error', error);
            triggerAlert('warning', 'Error disconnecting: ' + error);
            
            // Still reset UI on error
            resetUIAfterDisconnect();
        });
}

/**
 * Reset UI after disconnection
 */
function resetUIAfterDisconnect() {
    // Show the connection form
    showConnectionForm();
    
    // Show the connection container
    const sqlConnectionContainer = document.getElementById('sqlConnectionContainer');
    if (sqlConnectionContainer) {
        sqlConnectionContainer.classList.remove('hidden');
    }
    
    // Hide the logout button
    const logoutBtn = document.getElementById('sqlLogoutBtn');
    if (logoutBtn) {
        logoutBtn.classList.add('hidden');
    }
    
    // Clear UI state
    clearDatabaseSelect();
    clearTableSelect();
    clearTableData();
    clearQueryResult();
    
    // Hide database, table, global search, and export sections
    const databaseSection = document.getElementById('sqlDatabaseSection');
    if (databaseSection) {
        databaseSection.classList.add('hidden');
    }
    
    const tableSection = document.getElementById('sqlTableSection');
    if (tableSection) {
        tableSection.classList.add('hidden');
    }
    
    const globalSearchSection = document.getElementById('sqlGlobalSearchSection');
    if (globalSearchSection) {
        globalSearchSection.classList.add('hidden');
    }
    
    const exportSection = document.getElementById('sqlExportSection');
    if (exportSection) {
        exportSection.classList.add('hidden');
    }
    
    // Remove any status messages that might have been added
    const connectionContainer = document.getElementById('sqlConnectionContainer');
    if (connectionContainer) {
        // Remove any status div that might have been added (with class p-4)
        const statusDivs = connectionContainer.querySelectorAll('.p-4');
        statusDivs.forEach(div => {
            // Keep only the div containing the form
            if (!div.querySelector('#sqlConnectionForm')) {
                div.remove();
            }
        });
        
        // Show the form parent if it was hidden
        const formParent = document.querySelector('#sqlConnectionContainer .p-4');
        if (formParent && formParent.querySelector('#sqlConnectionForm')) {
            formParent.classList.remove('hidden');
        }
    }
}

/**
 * Hide connection form
 */
function hideConnectionForm() {
    // Hide the entire connection container
    const connectionContainer = document.getElementById('sqlConnectionContainer');
    if (connectionContainer) {
        connectionContainer.classList.add('hidden');
    }
    
    // Also hide the connection info section
    const connectionInfo = document.getElementById('sqlConnectionInfo');
    if (connectionInfo) {
        connectionInfo.classList.add('hidden');
    }
    
    // Show the export section after connection success
    const exportSection = document.getElementById('sqlExportSection');
    if (exportSection) {
        exportSection.classList.remove('hidden');
    }
}

/**
 * Show connection form
 */
function showConnectionForm() {
    // Instead of reloading the page, restore the connection form
    const connectionContainer = document.getElementById('sqlConnectionContainer');
    if (connectionContainer) {
        // Recreate the connection form HTML
        const formHTML = `
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg px-4 py-3 flex justify-between items-center">
                <h3 class="text-lg font-semibold flex items-center">
                    <i class="fas fa-plug mr-2"></i> Connection
                </h3>
                <button id="sqlLogoutBtn" class="hidden text-xs bg-blue-800 hover:bg-blue-900 text-white px-2 py-1 rounded transition-colors">
                    <i class="fas fa-sign-out-alt mr-1"></i> Disconnect
                </button>
            </div>
            <div class="p-4">
                <form id="sqlConnectionForm" class="space-y-3">
                    <div class="flex flex-col">
                        <label for="sqlHost" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Host</label>
                        <input type="text" id="sqlHost" name="host" value="localhost" 
                            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    </div>
                    <div class="flex flex-col">
                        <label for="sqlPort" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
                        <input type="text" id="sqlPort" name="port" value="3306"
                            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    </div>
                    <div class="flex flex-col">
                        <label for="sqlUser" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
                        <input type="text" id="sqlUser" name="user" value="root"
                            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    </div>
                    <div class="flex flex-col">
                        <label for="sqlPassword" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                        <input type="password" id="sqlPassword" name="password"
                            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    </div>
                    <div class="flex flex-col">
                        <label for="sqlDatabase" class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Database (optional)</label>
                        <input type="text" id="sqlDatabase" name="database"
                            class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white">
                    </div>
                    <div class="pt-2">
                        <button type="submit" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-sm px-4 py-2.5 text-center focus:outline-none transition duration-150">
                            <i class="fas fa-plug mr-2"></i> Connect
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        // Set the HTML content
        connectionContainer.innerHTML = formHTML;
        
        // Reattach event listeners
        const newConnectionForm = document.getElementById('sqlConnectionForm');
        if (newConnectionForm) {
            newConnectionForm.addEventListener('submit', function(e) {
                e.preventDefault();
                connectToDatabase();
            });
        }
        
        // Add event listener to logout button
        const logoutBtn = document.getElementById('sqlLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', disconnectDatabase);
        }
    }
}

/**
 * Show connection info
 */
function showConnectionInfo(info) {
    const connectionInfo = document.getElementById('sqlConnectionInfo');
    const connectionDetails = document.getElementById('sqlConnectionDetails');
    
    if (connectionInfo && connectionDetails) {
        connectionInfo.classList.remove('hidden');
        
        connectionDetails.innerHTML = `
            <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Host:</span>
                <span class="font-medium text-gray-800 dark:text-gray-200">${info.host}:${info.port}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">User:</span>
                <span class="font-medium text-gray-800 dark:text-gray-200">${info.user}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Database:</span>
                <span class="font-medium text-gray-800 dark:text-gray-200">${info.database}</span>
            </div>
        `;
    }
}

/**
 * Load list of databases
 */
function loadDatabases() {
    sqlDebugLog('Loading databases...');
    showLoadingState('Loading databases...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'databases',
        params: {}
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Databases result', result);
            
            if (result.success && result.databases) {
                populateDatabaseSelect(result.databases);
            } else {
                triggerAlert('warning', 'Failed to load databases: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Databases error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Load tables for selected database
 */
function loadTables(database) {
    sqlDebugLog(`Loading tables for database: ${database}`);
    clearTableSelect();
    clearTableStructure();
    clearTableData();
    
    // Show export section when database is selected
    const exportSection = document.getElementById('sqlExportSection');
    if (exportSection) {
        exportSection.classList.remove('hidden');
    }
    
    showLoadingState('Loading tables...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'tables',
        params: {
            database: database
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Tables result', result);
            
            if (result.success && result.tables) {
                populateTableSelect(result.tables);
                enableTableSection();
            } else {
                sqlDebugLog('Failed to load tables', result.error || 'Unknown error');
                triggerAlert('warning', 'Failed to load tables: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Tables error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Load structure (columns) for selected table
 */
function loadTableStructure(table) {
    // Function has been disabled since the Table Structure section was removed
    return;
}

/**
 * Load data for selected table
 */
function loadTableData(table, page = 1, limit = 50, orderBy = null, orderDir = 'ASC', search = null) {
    sqlDebugLog(`Loading data for table: ${table}, page: ${page}, limit: ${limit}, search: ${search}`);
    clearTableData();
    
    showLoadingState('Loading table data...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'data',
        params: {
            table: table,
            page: page,
            limit: limit,
            orderBy: orderBy,
            orderDir: orderDir
        }
    };
    
    // Add search parameter if provided
    if (search) {
        data.params.search = search;
    }
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Table data result', result);
            
            if (result.success) {
                renderTableData(result.data, result.total, page, limit, result.primaryKeys, table, search);
            } else {
                triggerAlert('warning', 'Failed to load table data: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Table data error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Execute custom SQL query
 */
function executeQuery() {
    const sqlQuery = document.getElementById('sqlQueryInput').value;
    
    if (!sqlQuery.trim()) {
        triggerAlert('warning', 'Please enter a SQL query');
        return;
    }
    
    clearQueryResult();
    showLoadingState('Executing query...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'query',
        params: {
            sql: sqlQuery
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            if (result.success) {
                if (result.data) {
                    renderQueryResult(result.data);
                } else if (result.affectedRows !== undefined) {
                    renderAffectedRows(result.affectedRows);
                } else {
                    renderEmptyResult();
                }
            } else {
                triggerAlert('warning', 'Query failed: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Custom triggerAlert function for SQL Explorer
 */
function triggerAlert(type, message) {
    // Try to use the existing triggerAlert function if available
    if (typeof window.triggerAlert === 'function' && window.triggerAlert !== triggerAlert) {
        window.triggerAlert(type, message);
        return;
    }
    
    // Fallback alert implementation
    const event = new CustomEvent('show-alert', {
        detail: {
            type: type,
            message: message
        }
    });
    document.dispatchEvent(event);
    
    // Also log to console as a backup
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// UI Helper Functions
function selectDatabase(database) {
    const databaseSelect = document.getElementById('sqlDatabaseSelect');
    if (databaseSelect) {
        databaseSelect.value = database;
        
        // Trigger change event
        const event = new Event('change');
        databaseSelect.dispatchEvent(event);
    }
}

/**
 * Populate select element with databases
 */
function populateDatabaseSelect(databases) {
    sqlDebugLog(`Populating database select with ${databases.length} databases`, databases);
    const select = document.getElementById('sqlDatabaseSelect');
    
    if (!select) {
        sqlDebugLog('Error: Database select element not found');
        return;
    }
    
    select.innerHTML = '<option value="">Select a database</option>';
    
    databases.forEach(db => {
        const option = document.createElement('option');
        option.value = db;
        option.textContent = db;
        select.appendChild(option);
    });
}

/**
 * Populate list element with tables
 */
function populateTableSelect(tables) {
    sqlDebugLog(`Populating table list with ${tables.length} tables`, tables);
    const tableList = document.getElementById('sqlTableList');
    const tableFilter = document.getElementById('sqlTableFilter');
    
    if (!tableList) {
        sqlDebugLog('Error: Table list element not found');
        return;
    }
    
    // Clear the list
    tableList.innerHTML = '';
    
    // If no tables, show message
    if (tables.length === 0) {
        tableList.innerHTML = '<li class="p-2 text-sm text-gray-500 dark:text-gray-400 text-center">No tables found</li>';
        return;
    }
    
    // Add each table as a list item
    tables.forEach(table => {
        const li = document.createElement('li');
        li.className = 'table-item hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer';
        li.dataset.tableName = table;
        li.innerHTML = `
            <div class="p-2 text-sm flex items-center">
                <i class="fas fa-table mr-2 text-indigo-500"></i>
                <span class="text-gray-800 dark:text-gray-200">${table}</span>
            </div>
        `;
        
        // Add click event to load table data
        li.addEventListener('click', function() {
            // Remove active class from all items
            const allItems = tableList.querySelectorAll('.table-item');
            allItems.forEach(item => {
                item.classList.remove('bg-indigo-50', 'dark:bg-indigo-900');
            });
            
            // Add active class to clicked item
            li.classList.add('bg-indigo-50', 'dark:bg-indigo-900');
            
            // Load table data
            loadTableData(table);
            
            // Show export section
            const exportSection = document.getElementById('sqlExportSection');
            if (exportSection) {
                exportSection.classList.remove('hidden');
            }
        });
        
        tableList.appendChild(li);
    });
    
    // Add filter functionality
    if (tableFilter) {
        tableFilter.addEventListener('input', function(e) {
            const filterValue = e.target.value.toLowerCase();
            const items = tableList.querySelectorAll('.table-item');
            
            items.forEach(item => {
                const tableName = item.dataset.tableName.toLowerCase();
                if (tableName.includes(filterValue)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
            
            // Show "no results" message if all items are hidden
            const visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
            if (visibleItems.length === 0 && filterValue) {
                const noResults = document.createElement('li');
                noResults.className = 'no-results p-2 text-sm text-gray-500 dark:text-gray-400 text-center';
                noResults.textContent = `No tables matching "${filterValue}"`;
                
                // Remove any existing no-results message
                const existingNoResults = tableList.querySelector('.no-results');
                if (existingNoResults) {
                    existingNoResults.remove();
                }
                
                tableList.appendChild(noResults);
            } else {
                // Remove no-results message if it exists
                const existingNoResults = tableList.querySelector('.no-results');
                if (existingNoResults) {
                    existingNoResults.remove();
                }
            }
        });
    }
}

function renderTableStructure(columns) {
    const container = document.getElementById('sqlTableStructure');
    if (!container) return;
    
    // Create table
    const table = document.createElement('table');
    table.className = 'sql-adminer-table w-full text-sm text-left';
    
    // Create header
    const thead = document.createElement('thead');
    
    const headerRow = document.createElement('tr');
    ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    columns.forEach(column => {
        const row = document.createElement('tr');
        
        ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'].forEach(field => {
            const td = document.createElement('td');
            
            // Highlight primary key with a special style
            if (field === 'Key' && column[field] === 'PRI') {
                td.innerHTML = '<span class="px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs font-semibold">PRI</span>';
            }
            // Highlight index with a special style
            else if (field === 'Key' && column[field] === 'MUL') {
                td.innerHTML = '<span class="px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold">MUL</span>';
            }
            // Highlight unique with a special style
            else if (field === 'Key' && column[field] === 'UNI') {
                td.innerHTML = '<span class="px-2 py-1 rounded bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold">UNI</span>';
            }
            // For Field, add a specific style
            else if (field === 'Field') {
                td.innerHTML = `<span class="font-medium">${column[field] !== null ? column[field] : ''}</span>`;
            }
            // For Type, add a specific style
            else if (field === 'Type') {
                td.innerHTML = `<span class="text-blue-600 dark:text-blue-400">${column[field] !== null ? column[field] : ''}</span>`;
            }
            // For NULL
            else if (field === 'Null') {
                if (column[field] === 'YES') {
                    td.innerHTML = '<span class="text-green-600 dark:text-green-400">YES</span>';
                } else {
                    td.innerHTML = '<span class="text-red-600 dark:text-red-400">NO</span>';
                }
            }
            // For Default value
            else if (field === 'Default' && column[field] === null) {
                td.innerHTML = '<span class="text-gray-400 italic">NULL</span>';
            }
            // For everything else
            else {
            td.textContent = column[field] !== null ? column[field] : '';
            }
            
            row.appendChild(td);
        });
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    
    // Clear container and add table
    container.innerHTML = '';
    container.appendChild(table);
    
    // Add an "Add column" button below the table
    const addColumnBtn = document.createElement('button');
    addColumnBtn.className = 'mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded text-sm px-4 py-2 text-center focus:outline-none transition duration-150';
    addColumnBtn.innerHTML = '<i class="fas fa-plus mr-2"></i> Add Column';
    
    container.appendChild(addColumnBtn);
}

// Add table column visibility management
let tableColumnVisibility = {}; // Used to store column visibility settings for each table

/**
 * Render table data with column visibility toggle
 */
function renderTableData(data, total, page, limit, primaryKeys = [], table, search = null) {
    sqlDebugLog('Rendering table data', { dataLength: data?.length, primaryKeys });
    const container = document.getElementById('sqlTableData');
    if (!container) return;
    
    if (!data || !data.length) {
        container.innerHTML = `
            <div class="p-4 text-gray-500 flex flex-col items-center justify-center">
                <p class="mb-4">No data found in table</p>
                <button id="addNewRowBtn" class="bg-green-600 hover:bg-green-700 text-white font-medium rounded text-sm px-4 py-2 text-center focus:outline-none transition duration-150">
                    <i class="fas fa-plus mr-2"></i> Add New Row
                </button>
            </div>
        `;
        
        // Add event listener for the add new row button
        const addNewRowBtn = document.getElementById('addNewRowBtn');
        if (addNewRowBtn) {
            addNewRowBtn.addEventListener('click', () => {
                showAddRowForm(table);
            });
        }
        
        return;
    }
    
    // Create a wrapper div with toolbar
    const wrapper = document.createElement('div');
    wrapper.className = 'mb-4';
    
    // Get all columns from the first row
    const columns = Object.keys(data[0]);
    
    // Initialize column visibility for this table if not done already
    if (!tableColumnVisibility[table]) {
        tableColumnVisibility[table] = {};
        columns.forEach(column => {
            tableColumnVisibility[table][column] = true; // All columns visible by default
        });
    }
    
    // Add toolbar with buttons
    const toolbar = document.createElement('div');
    toolbar.className = 'flex flex-wrap justify-between items-center mb-3 gap-2';
    
    // Add search functionality (Adminer-like search across all columns)
    const searchContainer = document.createElement('div');
    searchContainer.className = 'w-full flex items-center mb-3';
    
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'sqlTableSearch';
    searchInput.className = 'flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-l-md focus:ring-blue-500 focus:border-blue-500 block p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white';
    searchInput.placeholder = 'Search in all columns';
    searchInput.value = search || '';
    
    const searchButton = document.createElement('button');
    searchButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-r-md text-sm px-4 py-2 text-center focus:outline-none transition duration-150';
    searchButton.innerHTML = '<i class="fas fa-search"></i>';
    searchButton.addEventListener('click', () => {
        const searchValue = searchInput.value.trim();
        loadTableData(table, 1, limit, null, 'ASC', searchValue);
    });
    
    // Add event listener for enter key in search input
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const searchValue = searchInput.value.trim();
            loadTableData(table, 1, limit, null, 'ASC', searchValue);
        }
    });
    
    // Clear search button (only show if there's a search value)
    let clearButton = null;
    if (search) {
        clearButton = document.createElement('button');
        clearButton.className = 'ml-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded text-sm px-4 py-2 text-center focus:outline-none transition duration-150 dark:bg-gray-600 dark:hover:bg-gray-500 dark:text-gray-200';
        clearButton.innerHTML = '<i class="fas fa-times"></i> Clear';
        clearButton.addEventListener('click', () => {
            searchInput.value = '';
            loadTableData(table, 1, limit);
        });
    }
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(searchButton);
    if (clearButton) {
        searchContainer.appendChild(clearButton);
    }
    
    // Add title with record count
    const title = document.createElement('div');
    title.className = 'flex items-center';
    title.innerHTML = `
        <h4 class="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
            <span class="bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-xs font-bold">${total}</span>
            <span class="ml-1 mr-1">records in table</span>
            <span class="font-bold text-gray-700 dark:text-gray-300">${table}</span>
        </h4>
    `;
    
    // Create button group
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'flex items-center flex-wrap gap-2';
    
    // Add column visibility button
    const colVisButton = document.createElement('button');
    colVisButton.className = 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-medium rounded text-sm px-3 py-1.5 text-center focus:outline-none transition duration-150';
    colVisButton.innerHTML = '<i class="fas fa-columns mr-1"></i> Columns';
    colVisButton.addEventListener('click', () => {
        showColumnManager(table, columns);
    });
    
    // Add new row button
    const addButton = document.createElement('button');
    addButton.className = 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-medium rounded text-sm px-3 py-1.5 text-center focus:outline-none transition duration-150';
    addButton.innerHTML = '<i class="fas fa-plus mr-1"></i> New Record';
    addButton.addEventListener('click', () => {
        showAddRowForm(table);
    });
    
    // Add export button
    const exportButton = document.createElement('button');
    exportButton.className = 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-medium rounded text-sm px-3 py-1.5 text-center focus:outline-none transition duration-150';
    exportButton.innerHTML = '<i class="fas fa-file-export mr-1"></i> Export';
    
    buttonGroup.appendChild(colVisButton);
    buttonGroup.appendChild(addButton);
    buttonGroup.appendChild(exportButton);
    
    // First append search container
    wrapper.appendChild(searchContainer);
    
    // Then append the rest of the toolbar
    toolbar.appendChild(title);
    toolbar.appendChild(buttonGroup);
    wrapper.appendChild(toolbar);
    
    // Create table
    const table_el = document.createElement('table');
    table_el.className = 'sql-adminer-table w-full text-sm text-left';
    
    // Create header
    const thead = document.createElement('thead');
    
    const headerRow = document.createElement('tr');
    
    // Add only visible column headers
    columns.forEach(column => {
        if (tableColumnVisibility[table][column]) {
        const th = document.createElement('th');
            
            // Check if this column is a primary key or part of ordering
            let columnClass = '';
            if (primaryKeys && primaryKeys.includes(column)) {
                columnClass = 'text-yellow-700 dark:text-yellow-300';
            }
            
            // Create a column header that supports ordering
            const orderingHtml = `
                <div class="flex items-center justify-between cursor-pointer group" data-column="${column}">
                    <span class="${columnClass}">${column}</span>
                    <div class="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        <i class="fas fa-chevron-up text-xs mb-1"></i>
                        <i class="fas fa-chevron-down text-xs"></i>
                    </div>
                </div>
            `;
            
            th.innerHTML = orderingHtml;
            
            // Add click event for sorting
            th.addEventListener('click', (e) => {
                const column = th.querySelector('div').dataset.column;
                const currentOrderDir = th.classList.contains('asc') ? 'ASC' : (th.classList.contains('desc') ? 'DESC' : null);
                const newOrderDir = currentOrderDir === 'ASC' ? 'DESC' : 'ASC';
                
                // Remove sorting classes from all headers
                headerRow.querySelectorAll('th').forEach(header => {
                    header.classList.remove('asc', 'desc');
                });
                
                // Add sorting class to the clicked header
                th.classList.add(newOrderDir.toLowerCase());
                
                // Reload table data with new sorting
                loadTableData(table, page, limit, column, newOrderDir);
            });
            
        headerRow.appendChild(th);
        }
    });
    
    // Add action column header
    const actionHeader = document.createElement('th');
    actionHeader.textContent = 'Actions';
    actionHeader.className = 'text-center w-24'; // Fixed width for actions column
    headerRow.appendChild(actionHeader);
    
    thead.appendChild(headerRow);
    table_el.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        // Get primary key value if available
        let primaryKeyVal = null;
        let primaryKeyCol = null;
        
        if (primaryKeys && primaryKeys.length > 0) {
            primaryKeyCol = primaryKeys[0];
            primaryKeyVal = row[primaryKeyCol];
            tr.dataset.primaryKey = primaryKeyVal;
            tr.dataset.primaryKeyCol = primaryKeyCol;
        }
        
        // Add only visible data columns
        columns.forEach(column => {
            if (tableColumnVisibility[table][column]) {
            const td = document.createElement('td');
                
                const value = row[column];
                
                // Apply special formatting based on column or value type
                if (value === null) {
                    td.innerHTML = '<span class="text-gray-400 italic">NULL</span>';
                } else if (primaryKeys && primaryKeys.includes(column)) {
                    // Format primary key values
                    td.innerHTML = `<span class="font-medium text-yellow-700 dark:text-yellow-300">${value}</span>`;
                } else if (typeof value === 'number') {
                    // Right-align numeric values
                    td.className = 'text-right';
                    td.textContent = value;
                } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}.*$/)) {
                    // Format date/datetime values
                    td.className = 'text-indigo-600 dark:text-indigo-400';
                    td.textContent = value;
                } else if (typeof value === 'string' && value.length > 100) {
                    // Truncate long string values
                    td.innerHTML = `<span class="cursor-pointer text-gray-600 dark:text-gray-400" title="${value.replace(/"/g, '&quot;')}">${value.substring(0, 100)}...</span>`;
                } else {
                    td.textContent = value;
                }
                
            tr.appendChild(td);
            }
        });
        
        // Add action buttons
        const actionCell = document.createElement('td');
        actionCell.className = 'whitespace-nowrap text-center';
        
        // Only add edit/delete if we have a primary key
        if (primaryKeyVal !== null && primaryKeyCol !== null) {
            const actionButtonsContainer = document.createElement('div');
            actionButtonsContainer.className = 'flex justify-center space-x-2';
            
            // Edit button
            const editBtn = document.createElement('button');
            editBtn.className = 'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900 rounded';
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.title = 'Edit';
            editBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                editRow(table, primaryKeyCol, primaryKeyVal);
            };
            
            // Delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm p-1.5 hover:bg-red-100 dark:hover:bg-red-900 rounded';
            deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
            deleteBtn.title = 'Delete';
            deleteBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm(`Are you sure you want to delete this record where ${primaryKeyCol} = ${primaryKeyVal}?`)) {
                    deleteRow(table, primaryKeyCol, primaryKeyVal);
                }
            };
            
            // Clone button
            const cloneBtn = document.createElement('button');
            cloneBtn.className = 'text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-medium text-sm p-1.5 hover:bg-green-100 dark:hover:bg-green-900 rounded';
            cloneBtn.innerHTML = '<i class="fas fa-clone"></i>';
            cloneBtn.title = 'Clone';
            cloneBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                cloneRow(table, primaryKeyCol, primaryKeyVal);
            };
            
            actionButtonsContainer.appendChild(editBtn);
            actionButtonsContainer.appendChild(deleteBtn);
            actionButtonsContainer.appendChild(cloneBtn);
            actionCell.appendChild(actionButtonsContainer);
        }
        
        tr.appendChild(actionCell);
        tbody.appendChild(tr);
    });
    
    table_el.appendChild(tbody);
    
    // Create pagination container
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination-container mt-4 flex justify-center py-3 bg-gray-50 dark:bg-gray-800 rounded-lg';
    paginationContainer.innerHTML = createPaginationControls(page, limit, total, table);
    
    // Clear container and add content
    container.innerHTML = '';
    container.appendChild(wrapper);
    container.appendChild(table_el);
    
    // Add pagination if there are more than one page
    if (Math.ceil(total / limit) > 1) {
        container.appendChild(paginationContainer);
        setupPaginationEvents(paginationContainer, page, limit, table);
    }
    
    // Add record count at the bottom
    const recordCount = document.createElement('div');
    recordCount.className = 'text-xs text-gray-500 mt-2 text-right';
    recordCount.textContent = `Showing records ${(page - 1) * limit + 1} to ${Math.min(page * limit, total)} of ${total}`;
    container.appendChild(recordCount);
}

function renderQueryResult(data) {
    const container = document.getElementById('sqlQueryResult');
    if (!container) return;
    
    if (!data || !data.length) {
        container.innerHTML = '<div class="p-4 text-gray-500">Query executed successfully but returned no data</div>';
        return;
    }
    
    // Create result header
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-3';
    
    const resultTitle = document.createElement('h4');
    resultTitle.className = 'text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center';
    resultTitle.innerHTML = `
        <span class="bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 px-2 py-1 rounded text-xs font-bold mr-2">
            ${data.length}
        </span>
        <span>rows returned</span>
    `;
    
    // Create button group for result actions
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'flex items-center gap-2';
    
    // Add export button
    const exportButton = document.createElement('button');
    exportButton.className = 'bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white font-medium rounded text-sm px-3 py-1.5 text-center focus:outline-none transition duration-150';
    exportButton.innerHTML = '<i class="fas fa-file-export mr-1"></i> Export';
    
    buttonGroup.appendChild(exportButton);
    
    header.appendChild(resultTitle);
    header.appendChild(buttonGroup);
    
    // Create table
    const table = document.createElement('table');
    table.className = 'sql-adminer-table w-full text-sm text-left';
    
    // Create header
    const thead = document.createElement('thead');
    
    const headerRow = document.createElement('tr');
    
    // Get column names from first row
    Object.keys(data[0]).forEach(column => {
        const th = document.createElement('th');
        th.textContent = column;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');
    
    data.forEach(row => {
        const tr = document.createElement('tr');
        
        Object.entries(row).forEach(([column, value]) => {
            const td = document.createElement('td');
            
            // Apply special formatting based on value type
            if (value === null) {
                td.innerHTML = '<span class="text-gray-400 italic">NULL</span>';
            } else if (typeof value === 'number') {
                // Right-align numeric values
                td.className = 'text-right';
                td.textContent = value;
            } else if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}.*$/)) {
                // Format date/datetime values
                td.className = 'text-gray-600 dark:text-gray-400';
                td.textContent = value;
            } else if (typeof value === 'string' && value.length > 100) {
                // Truncate long string values
                td.innerHTML = `<span class="cursor-pointer text-gray-600 dark:text-gray-400" title="${value.replace(/"/g, '&quot;')}">${value.substring(0, 100)}...</span>`;
            } else {
                td.textContent = value;
            }
            
            tr.appendChild(td);
        });
        
        tbody.appendChild(tr);
    });
    
    table.appendChild(tbody);
    
    // Clear container and add content
    container.innerHTML = '';
    container.appendChild(header);
    container.appendChild(table);
    
    // Add execution time footer
    const footer = document.createElement('div');
    footer.className = 'mt-2 text-xs text-gray-500 text-right';
    footer.textContent = `Execution time: ${new Date().toLocaleTimeString()}`;
    container.appendChild(footer);
}

function renderAffectedRows(affectedRows) {
    const container = document.getElementById('sqlQueryResult');
    if (!container) return;
    
    container.innerHTML = `
        <div class="rounded-lg bg-gray-50 dark:bg-gray-700 p-4 flex items-start border border-gray-200 dark:border-gray-600">
            <div class="flex-shrink-0 mr-3">
                <i class="fas fa-check-circle text-gray-600 dark:text-gray-300 text-xl"></i>
            </div>
            <div>
                <h3 class="font-medium text-gray-800 dark:text-gray-200">Query executed successfully</h3>
                <div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    <div class="flex items-center">
                        <span class="font-semibold bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded mr-2">${affectedRows}</span>
                        <span>row(s) affected</span>
                    </div>
                    <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Execution time: ${new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderEmptyResult() {
    const container = document.getElementById('sqlQueryResult');
    if (!container) return;
    
    container.innerHTML = `
        <div class="rounded-lg bg-gray-50 dark:bg-gray-700 p-4 flex items-start border border-gray-200 dark:border-gray-600">
            <div class="flex-shrink-0 mr-3">
                <i class="fas fa-info-circle text-gray-600 dark:text-gray-300 text-xl"></i>
            </div>
            <div>
                <h3 class="font-medium text-gray-800 dark:text-gray-200">Query executed successfully</h3>
                <div class="mt-1 text-sm text-gray-700 dark:text-gray-300">
                    The query was executed but returned no results.
                    <div class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Execution time: ${new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createPaginationControls(currentPage, limit, total, table) {
    const totalPages = Math.ceil(total / limit);
    
    if (totalPages <= 1) {
        return '';
    }
    
    let controls = '';
    
    // First page button
    controls += `
        <button class="pagination-button bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-l-md px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            data-page="1" 
            ${currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <i class="fas fa-angle-double-left"></i>
        </button>
    `;

    // Previous button
    controls += `
        <button class="pagination-button bg-white dark:bg-gray-700 border-t border-b border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            data-page="${currentPage > 1 ? currentPage - 1 : 1}" 
            ${currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <i class="fas fa-angle-left"></i>
        </button>
    `;
    
    // Page numbers
    const maxVisiblePages = 5;
    const halfVisible = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, currentPage - halfVisible);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        controls += `
            <span class="flex items-center justify-center bg-gray-100 dark:bg-gray-800 border-t border-b border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2">
                ...
            </span>
        `;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            controls += `
                <button class="pagination-button active bg-blue-600 border-t border-b border-blue-600 text-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    data-page="${i}">${i}</button>
            `;
        } else {
            controls += `
                <button class="pagination-button bg-white dark:bg-gray-700 border-t border-b border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    data-page="${i}">${i}</button>
            `;
        }
    }
    
    if (endPage < totalPages) {
        controls += `
            <span class="flex items-center justify-center bg-gray-100 dark:bg-gray-800 border-t border-b border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2">
                ...
            </span>
        `;
    }
    
    // Next button
    controls += `
        <button class="pagination-button bg-white dark:bg-gray-700 border-t border-b border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            data-page="${currentPage < totalPages ? currentPage + 1 : totalPages}"
            ${currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <i class="fas fa-angle-right"></i>
        </button>
    `;

    // Last page button
    controls += `
        <button class="pagination-button bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-r-md px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
            data-page="${totalPages}" 
            ${currentPage === totalPages ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
            <i class="fas fa-angle-double-right"></i>
        </button>
    `;
    
    return controls;
}

function setupPaginationEvents(container, currentPage, limit, table) {
    const buttons = container.querySelectorAll('.pagination-button');
    
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            const page = parseInt(this.dataset.page, 10);
            if (page !== currentPage) {
                // Use the table parameter directly instead of looking for tableSelect element
                loadTableData(table, page, limit);
            }
        });
    });
}

/**
 * Enable database section
 */
function enableDatabaseSection() {
    const databaseSection = document.getElementById('sqlDatabaseSection');
    if (databaseSection) {
        databaseSection.classList.remove('hidden');
    }
    
    // Show Global Search section too
    const globalSearchSection = document.getElementById('sqlGlobalSearchSection');
    if (globalSearchSection) {
        globalSearchSection.classList.remove('hidden');
    }
    
    // Add event listener to the database disconnect button
    const disconnectBtn = document.getElementById('sqlDatabaseDisconnectBtn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectDatabase);
    }
}

/**
 * Enable table section
 */
function enableTableSection() {
    const tableSection = document.getElementById('sqlTableSection');
    if (tableSection) {
        tableSection.classList.remove('hidden');
    }
    
    // Export section is now shown when a database is selected, not here
}

/**
 * Clear database select
 */
function clearDatabaseSelect() {
    sqlDebugLog('Clearing database select');
    const select = document.getElementById('sqlDatabaseSelect');
    if (select) select.innerHTML = '<option value="">Select a database</option>';
}

/**
 * Clear table select
 */
function clearTableSelect() {
    sqlDebugLog('Clearing table select');
    const tableList = document.getElementById('sqlTableList');
    if (tableList) {
        tableList.innerHTML = '<li class="p-2 text-sm text-gray-500 dark:text-gray-400 text-center">No tables found</li>';
    }
    
    // Also clear the filter input if it exists
    const tableFilter = document.getElementById('sqlTableFilter');
    if (tableFilter) {
        tableFilter.value = '';
    }
}

function clearTableStructure() {
    // Function has been disabled since the Table Structure section was removed
    return;
}

function clearTableData() {
    const container = document.getElementById('sqlTableData');
    if (container) {
        container.innerHTML = '';
    }
}

function clearQueryResult() {
    const container = document.getElementById('sqlQueryResult');
    if (container) {
        container.innerHTML = '';
    }
}

/**
 * Show loading state
 */
function showLoadingState(message = 'Loading...') {
    sqlDebugLog(`Showing loading state: ${message}`);
    const loadingDiv = document.getElementById('sqlLoadingIndicator');
    const messageEl = document.getElementById('sqlLoadingMessage');
    
    if (loadingDiv) {
        sqlDebugLog('Found loading indicator element');
        loadingDiv.classList.remove('hidden');
    } else {
        sqlDebugLog('ERROR: Loading indicator element not found!');
    }
    
    if (messageEl) {
        messageEl.textContent = message;
    } else {
        sqlDebugLog('ERROR: Loading message element not found!');
    }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    sqlDebugLog('Hiding loading state');
    const loadingDiv = document.getElementById('sqlLoadingIndicator');
    if (loadingDiv) {
        loadingDiv.classList.add('hidden');
    } else {
        sqlDebugLog('ERROR: Loading indicator element not found!');
    }
}

/**
 * Edit a row
 */
function editRow(table, primaryKeyCol, primaryKeyVal) {
    sqlDebugLog(`Editing row: ${table}, ${primaryKeyCol}=${primaryKeyVal}`);
    showLoadingState('Loading row data...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'get_row',
        params: {
            table: table,
            primaryKeyCol: primaryKeyCol,
            primaryKeyVal: primaryKeyVal
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Get row result', result);
            
            if (result.success && result.row) {
                showEditForm(table, primaryKeyCol, primaryKeyVal, result.row, result.columnTypes);
            } else {
                triggerAlert('warning', 'Failed to load row data: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Get row error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Delete a row
 */
function deleteRow(table, primaryKeyCol, primaryKeyVal) {
    sqlDebugLog(`Deleting row: ${table}, ${primaryKeyCol}=${primaryKeyVal}`);
    showLoadingState('Deleting row...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'delete_row',
        params: {
            table: table,
            primaryKeyCol: primaryKeyCol,
            primaryKeyVal: primaryKeyVal
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Delete row result', result);
            
            if (result.success) {
                triggerAlert('success', 'Row deleted successfully!');
                // Reload the table data
                loadTableData(table);
            } else {
                triggerAlert('warning', 'Failed to delete row: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Delete row error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Show edit form for a row with column visibility control
 */
function showEditForm(table, primaryKeyCol, primaryKeyVal, rowData, columnTypes) {
    sqlDebugLog('Showing edit form', { table, primaryKeyCol, primaryKeyVal, rowData });
    
    // Create modal
    const modal = createModal(`Edit Record in ${table}`, 'lg');
    
    // Create form
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.id = 'editRowForm';
    
    // Add a note at the top about primary key
    const primaryKeyNote = document.createElement('div');
    primaryKeyNote.className = 'mb-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-md text-sm text-blue-700 dark:text-blue-300';
    primaryKeyNote.innerHTML = `
        <div class="flex items-start">
            <i class="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-1 mr-2"></i>
            <div>
                <p>Editing record where <span class="font-semibold">${primaryKeyCol} = ${primaryKeyVal}</span></p>
            </div>
        </div>
    `;
    
    form.appendChild(primaryKeyNote);
    
    // Create input fields for each column
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'grid grid-cols-1 gap-4';
    
    Object.keys(rowData).forEach(column => {
        const value = rowData[column];
        const columnType = columnTypes && columnTypes[column] ? columnTypes[column] : null;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
        label.textContent = column;
        
        // Determine if this is the primary key (disabled)
        const isPrimaryKey = column === primaryKeyCol;
        
        // Create appropriate input based on column type
        let input;
        
        // Get the data type from the column type object
        const dataType = columnType && columnType['DATA_TYPE'] ? columnType['DATA_TYPE'] : null;
        
        // For text type fields
        if (dataType && (
            dataType === 'varchar' || 
            dataType === 'text' || 
            dataType === 'char' ||
            dataType === 'enum' ||
            dataType === 'set' ||
            dataType.includes('text') ||
            dataType.includes('char')
        )) {
            // For longer text fields
            if (dataType === 'text' || dataType.includes('text') || (value && typeof value === 'string' && value.length > 100)) {
                input = document.createElement('textarea');
                input.rows = 3;
            } else {
                input = document.createElement('input');
                input.type = 'text';
            }
        }
        // For numeric fields
        else if (dataType && (
            dataType === 'int' ||
            dataType === 'tinyint' ||
            dataType === 'smallint' ||
            dataType === 'mediumint' ||
            dataType === 'bigint' ||
            dataType === 'decimal' || 
            dataType === 'float' || 
            dataType === 'double' ||
            dataType.includes('int') ||
            dataType.includes('decimal') ||
            dataType.includes('float') ||
            dataType.includes('double')
        )) {
                input = document.createElement('input');
            input.type = 'number';
            if (dataType === 'decimal' || dataType === 'float' || dataType === 'double' ||
                dataType.includes('decimal') || dataType.includes('float') || dataType.includes('double')) {
                input.step = '0.01';
            }
        }
        // For date fields
        else if (dataType && (dataType === 'date' || dataType.includes('date'))) {
                input = document.createElement('input');
            input.type = 'date';
                if (value) {
                // Format date for date input
                const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    input.value = dateMatch[1];
                }
            }
        }
        // For datetime fields
        else if (dataType && (dataType === 'datetime' || dataType.includes('datetime') || dataType === 'timestamp')) {
                input = document.createElement('input');
            input.type = 'datetime-local';
            if (value) {
                // Format datetime for datetime-local input
                // Full regex to capture YYYY-MM-DD HH:MM:SS format
                const dateTimeMatch = value.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:?\d{0,2})/);
                if (dateTimeMatch) {
                    // Convert to format required by datetime-local input (YYYY-MM-DDThh:mm)
                    // Extract just the hours and minutes for the time part
                    const datePart = dateTimeMatch[1];
                    const timePart = dateTimeMatch[2].substring(0, 5); // Get just HH:MM
                    input.value = `${datePart}T${timePart}`;
                    
                    // Add a note about the original value
                    const noteSpan = document.createElement('span');
                    noteSpan.className = 'text-xs text-gray-500 block mt-1';
                    noteSpan.textContent = `Original value: ${value}`;
                    
                    // We'll append this note after the input element
                    setTimeout(() => {
                        if (input.parentNode) {
                            input.parentNode.insertBefore(noteSpan, input.nextSibling);
                        }
                    }, 0);
        } else {
                    // If the regex didn't match, just use the value as is
                    input.value = value;
                }
            }
        }
        // For time fields
        else if (dataType && (dataType === 'time' || dataType.includes('time'))) {
            input = document.createElement('input');
            input.type = 'time';
        }
        // Default to text input
        else {
            input = document.createElement('input');
            input.type = 'text';
        }
        
        // Set common attributes
        input.name = column;
        input.id = `edit_${column}`;
        input.className = 'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white';
        
        // Set value if not null
        if (value !== null && input.type !== 'date' && input.type !== 'datetime-local') {
            input.value = value;
        }
        
        // Disable if primary key
        if (isPrimaryKey) {
            input.disabled = true;
            input.className += ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
        }
        
        // If NULL is allowed, add a NULL checkbox
        const nullCheckbox = document.createElement('div');
        nullCheckbox.className = 'mt-1 flex items-center space-x-2';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `null_${column}`;
        checkbox.className = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
        
        // Check if value is NULL
        if (value === null) {
            checkbox.checked = true;
            input.disabled = true;
            input.className += ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
        }
        
        const nullLabel = document.createElement('label');
        nullLabel.className = 'text-xs text-gray-600 dark:text-gray-400';
        nullLabel.textContent = 'NULL';
        nullLabel.htmlFor = `null_${column}`;
        
        // Add event listener to toggle input disabled state
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                input.disabled = true;
                input.className = input.className + ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
            } else {
                if (!isPrimaryKey) {
                    input.disabled = false;
                    input.className = input.className.replace(' bg-gray-100 dark:bg-gray-800 cursor-not-allowed', '');
                }
            }
        });
        
        nullCheckbox.appendChild(checkbox);
        nullCheckbox.appendChild(nullLabel);
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        
        // Only add NULL checkbox if this is not the primary key
        if (!isPrimaryKey) {
            formGroup.appendChild(nullCheckbox);
        }
        
        fieldContainer.appendChild(formGroup);
    });
    
    form.appendChild(fieldContainer);
    modal.body.appendChild(form);
    
    // Add save button
    const saveButton = document.createElement('button');
    saveButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150';
    saveButton.textContent = 'Save Changes';
    saveButton.addEventListener('click', function() {
        // Get form data
        updateRow(table, primaryKeyCol, primaryKeyVal, form);
        hideModal(modal);
    });
    
    // Add cancel button
    const cancelButton = document.createElement('button');
    cancelButton.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function() {
        modal.close();
    });
    
    modal.footer.appendChild(cancelButton);
    modal.footer.appendChild(saveButton);
}

/**
 * Update a row
 */
function updateRow(table, primaryKeyCol, primaryKeyVal, form) {
    sqlDebugLog('Updating row', { table, primaryKeyCol, primaryKeyVal });
    showLoadingState('Updating row...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'update_row',
        params: {
            table: table,
            primaryKeyCol: primaryKeyCol,
            primaryKeyVal: primaryKeyVal,
            updates: {}
        }
    };
    
    // Process form data
    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
        // Skip checkboxes for NULL handling
        if (key.startsWith('null_')) continue;
        
        const columnName = key.startsWith('edit_') ? key.substring(5) : key;
        
        // Skip the primary key field
        if (columnName === primaryKeyCol) {
            continue;
        }
        
        // Check if NULL checkbox is checked
        const nullCheckbox = form.querySelector(`#null_${columnName}`);
        if (nullCheckbox && nullCheckbox.checked) {
            data.params.updates[columnName] = null;
            continue;
        }
        
        // Handle datetime-local inputs - convert from YYYY-MM-DDThh:mm to YYYY-MM-DD hh:mm:ss
        const inputElement = form.elements[key];
        if (inputElement && inputElement.type === 'datetime-local' && value) {
            // Convert from YYYY-MM-DDThh:mm to YYYY-MM-DD hh:mm:ss
            const dateTime = new Date(value);
            if (!isNaN(dateTime.getTime())) {
                const formattedDate = dateTime.toISOString().slice(0, 19).replace('T', ' ');
                data.params.updates[columnName] = formattedDate;
                continue;
            }
        }
        
        // Handle empty values as NULL if appropriate
        if (value === '') {
            // Check if the field has placeholder indicating nullable
            if (inputElement && inputElement.placeholder && inputElement.placeholder.toLowerCase().includes('null')) {
                data.params.updates[columnName] = null;
            } else {
                data.params.updates[columnName] = '';
            }
        } else {
            data.params.updates[columnName] = value;
        }
    }
    
    sqlDebugLog('Update data', data.params.updates);
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Update row result', result);
            
            if (result.success) {
                triggerAlert('success', 'Row updated successfully!');
                // Reload the table data
                loadTableData(table);
            } else {
                triggerAlert('warning', 'Failed to update row: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Update row error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Show add row form
 */
function showAddRowForm(table) {
    sqlDebugLog('Showing add row form', { table });
    showLoadingState('Loading table structure...');
    
    // First, get table structure to create form fields
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'structure',
        params: {
            table: table
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Get table structure for new row', result);
            
            if (!result.success || !result.columns) {
                triggerAlert('warning', 'Failed to get table structure: ' + (result.error || 'Unknown error'));
                return;
            }
            
            // Get column types
            const columnTypesRequest = {
                csrf: getCsrfToken(),
                action: 'sql_explorer',
                sql_action: 'column_types',
                params: {
                    table: table
                }
            };
            
            sqlSendRequest(columnTypesRequest)
                .then(typesResult => {
                    const columnTypes = typesResult.success ? typesResult.columnTypes : {};
                    createAddRowForm(table, result.columns, columnTypes);
                })
                .catch(error => {
                    sqlDebugLog('Get column types error', error);
                    // Continue with empty column types if there was an error
                    createAddRowForm(table, result.columns, {});
                });
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Get table structure error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Create the add row form with the table structure
 */
function createAddRowForm(table, columns, columnTypes) {
    // Create modal dialog
    const modal = createModal('Add New Row', 'lg');
    
    // Show the modal
    document.body.appendChild(modal);
    modal.classList.add('show');
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    
    const modalBody = modal.querySelector('.modal-body');
    
    // Create form
    const form = document.createElement('form');
    form.id = 'addRowForm';
    form.className = 'space-y-4';
    
    // Create input fields for each column
    columns.forEach(column => {
        const columnName = column.Field;
        const columnType = columnTypes[columnName] || null;
        const isPrimaryKey = column.Key === 'PRI';
        const isAutoIncrement = column.Extra.includes('auto_increment');
        const isNullable = column.Null === 'YES';
        
        const formGroup = document.createElement('div');
        formGroup.className = 'flex flex-col mb-4';
        
        // Label
        const label = document.createElement('label');
        label.htmlFor = `new_${columnName}`;
        label.className = 'text-sm font-medium text-gray-600 dark:text-gray-400 mb-1';
        
        // Add indicators for primary key, nullable, etc.
        let labelText = columnName;
        if (isPrimaryKey) labelText += ' (Primary Key)';
        if (!isNullable && !isAutoIncrement) labelText += ' *';
        if (isAutoIncrement) labelText += ' (Auto Increment)';
        
        label.textContent = labelText;
        
        // Skip auto-increment fields as they're automatically generated
        if (isAutoIncrement) {
            label.className += ' text-gray-400';
            formGroup.appendChild(label);
            
            const autoIncrementNote = document.createElement('span');
            autoIncrementNote.className = 'text-sm italic text-gray-500 dark:text-gray-400';
            autoIncrementNote.textContent = 'Value will be generated automatically';
            formGroup.appendChild(autoIncrementNote);
            
            form.appendChild(formGroup);
            return;
        }
        
        // Input field
        let input;
        
        // Create appropriate input based on column type
        if (columnType && columnType.DATA_TYPE) {
            const dataType = columnType.DATA_TYPE.toLowerCase();
            
            // Text area for long text fields
            if (['text', 'longtext', 'mediumtext'].includes(dataType)) {
                input = document.createElement('textarea');
                input.rows = 4;
            } 
            // Special input types for dates, times, etc.
            else if (dataType === 'date') {
                input = document.createElement('input');
                input.type = 'date';
            }
            else if (dataType === 'time') {
                input = document.createElement('input');
                input.type = 'time';
            }
            else if (dataType === 'datetime' || dataType === 'timestamp') {
                input = document.createElement('input');
                input.type = 'datetime-local';
            }
            else if (dataType === 'tinyint' && column.Type === 'tinyint(1)') {
                // Special case for boolean (tinyint(1))
                input = document.createElement('select');
                
                const nullOption = document.createElement('option');
                nullOption.value = '';
                nullOption.textContent = 'NULL';
                input.appendChild(nullOption);
                
                const trueOption = document.createElement('option');
                trueOption.value = '1';
                trueOption.textContent = 'TRUE (1)';
                input.appendChild(trueOption);
                
                const falseOption = document.createElement('option');
                falseOption.value = '0';
                falseOption.textContent = 'FALSE (0)';
                input.appendChild(falseOption);
            }
            // Regular text input for other types
            else {
                input = document.createElement('input');
                input.type = 'text';
                
                // Add specific validation for number types
                if (['int', 'tinyint', 'smallint', 'mediumint', 'bigint', 'decimal', 'float', 'double'].includes(dataType)) {
                    input.pattern = '[0-9.\\-]*';
                }
            }
        } else {
            // Default to text input if column type info not available
            input = document.createElement('input');
            input.type = 'text';
        }
        
        // Set common properties
        input.id = `new_${columnName}`;
        input.name = `new_${columnName}`;
        input.className = 'border rounded-lg p-2 dark:bg-gray-700 dark:border-gray-600 dark:text-white';
        
        // If nullable, add placeholder
        if (isNullable) {
            input.placeholder = 'NULL (leave empty)';
        }
        
        // If default value exists, use it
        if (column.Default !== null) {
            input.value = column.Default;
        }
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        form.appendChild(formGroup);
    });
    
    // Create form actions
    const formActions = document.createElement('div');
    formActions.className = 'mt-4 flex justify-end space-x-2';
    
    const addBtn = document.createElement('button');
    addBtn.type = 'submit';
    addBtn.className = 'bg-blue-500 hover:bg-blue-600 text-white font-medium rounded text-sm px-4 py-2 text-center focus:outline-none transition duration-150';
    addBtn.textContent = 'Add Row';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'bg-gray-500 hover:bg-gray-600 text-white font-medium rounded text-sm px-4 py-2 text-center focus:outline-none transition duration-150';
    cancelBtn.textContent = 'Cancel';
    
    formActions.appendChild(addBtn);
    formActions.appendChild(cancelBtn);
    form.appendChild(formActions);
    
    // Add form to modal body
    modalBody.appendChild(form);
    
    // Add event listeners
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        addRow(table, form);
        hideModal(modal);
    });
    
    cancelBtn.addEventListener('click', function() {
        hideModal(modal);
    });
}

/**
 * Create a modal dialog
 */
function createModal(title, size = 'md') {
    // Create modal wrapper
    const modalWrapper = document.createElement('div');
    modalWrapper.className = 'modal-wrapper fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // Set modal size
    let modalWidth = 'max-w-md';
    if (size === 'sm') modalWidth = 'max-w-sm';
    if (size === 'lg') modalWidth = 'max-w-lg';
    if (size === 'xl') modalWidth = 'max-w-xl';
    if (size === '2xl') modalWidth = 'max-w-2xl';
    if (size === '3xl') modalWidth = 'max-w-3xl';
    if (size === '4xl') modalWidth = 'max-w-4xl';
    if (size === '5xl') modalWidth = 'max-w-5xl';
    
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.className = `relative w-full ${modalWidth} mx-auto`;
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700';
    
    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 text-white flex justify-between items-center';
    
    const modalTitle = document.createElement('h3');
    modalTitle.className = 'text-lg font-semibold';
    modalTitle.textContent = title;
    
    const closeButton = document.createElement('button');
    closeButton.className = 'text-white hover:text-gray-200 focus:outline-none transition duration-150';
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    closeButton.addEventListener('click', function() {
        hideModal(modalWrapper);
    });
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    
    // Create modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'p-4';
    
    // Create modal footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'bg-gray-50 dark:bg-gray-700 px-4 py-3 flex justify-end space-x-2 border-t border-gray-200 dark:border-gray-600';
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modalContainer.appendChild(modalContent);
    modalWrapper.appendChild(modalContainer);
    
    // Add modal to body
    document.body.appendChild(modalWrapper);
    
    // Add animation
    setTimeout(() => {
        modalWrapper.classList.add('visible');
    }, 10);
    
    // Add keydown event for ESC key
    const keyHandler = function(e) {
        if (e.key === 'Escape') {
            hideModal(modalWrapper);
            document.removeEventListener('keydown', keyHandler);
        }
    };
    document.addEventListener('keydown', keyHandler);
    
    // Return modal elements for further manipulation
    return {
        wrapper: modalWrapper,
        container: modalContainer,
        content: modalContent,
        header: modalHeader,
        title: modalTitle,
        body: modalBody,
        footer: modalFooter,
        close: () => hideModal(modalWrapper)
    };
}

/**
 * Hide a modal dialog
 */
function hideModal(modal) {
    if (typeof modal === 'object' && modal.wrapper) {
        modal = modal.wrapper;
    }
    
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            try {
                document.body.removeChild(modal);
            } catch (e) {
                console.error('Error removing modal:', e);
            }
        }, 200);
    }
}

/**
 * Add a new row
 */
function addRow(table, form) {
    sqlDebugLog('Adding new row', { table });
    showLoadingState('Adding new row...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'add_row',
        params: {
            table: table,
            new_row: {}
        }
    };
    
    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('new_')) {
            data.params.new_row[key.substring(4)] = value;
        }
    }
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Add row result', result);
            
            if (result.success) {
                triggerAlert('success', 'Row added successfully!');
                // Reload the table data
                loadTableData(table);
            } else {
                triggerAlert('warning', 'Failed to add row: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Add row error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Show column manager dialog
 */
function showColumnManager(table, columns) {
    sqlDebugLog('Showing column manager', { table, columns });
    
    // Create modal
    const modal = createModal(`Manage Columns for ${table}`, 'lg');
    
    // Create description text
    const description = document.createElement('p');
    description.className = 'text-sm text-gray-600 dark:text-gray-400 mb-4';
    description.textContent = 'Select which columns to display in the table data view.';
    modal.body.appendChild(description);
    
    // Create form for columns
    const form = document.createElement('form');
    form.className = 'space-y-2';
    
    // Create a button to toggle all
    const toggleAllContainer = document.createElement('div');
    toggleAllContainer.className = 'flex justify-between items-center mb-3 pb-2 border-b border-gray-200 dark:border-gray-700';
    
    const toggleAllLabel = document.createElement('span');
    toggleAllLabel.className = 'text-sm font-medium text-gray-700 dark:text-gray-300';
    toggleAllLabel.textContent = 'Toggle all columns';
    
    const toggleButtonsContainer = document.createElement('div');
    toggleButtonsContainer.className = 'flex space-x-2';
    
    const selectAllButton = document.createElement('button');
    selectAllButton.type = 'button';
    selectAllButton.className = 'text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded';
    selectAllButton.textContent = 'Select All';
    selectAllButton.addEventListener('click', function(e) {
        e.preventDefault();
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = true;
        });
    });
    
    const deselectAllButton = document.createElement('button');
    deselectAllButton.type = 'button';
    deselectAllButton.className = 'text-xs bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded';
    deselectAllButton.textContent = 'Deselect All';
    deselectAllButton.addEventListener('click', function(e) {
        e.preventDefault();
        form.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = false;
        });
    });
    
    toggleButtonsContainer.appendChild(selectAllButton);
    toggleButtonsContainer.appendChild(deselectAllButton);
    
    toggleAllContainer.appendChild(toggleAllLabel);
    toggleAllContainer.appendChild(toggleButtonsContainer);
    
    form.appendChild(toggleAllContainer);
    
    // Create grid for columns
    const columnsGrid = document.createElement('div');
    columnsGrid.className = 'grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto p-2';
    
    // Add checkbox for each column
    columns.forEach(column => {
        const columnContainer = document.createElement('div');
        columnContainer.className = 'flex items-center p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `col_${column}`;
        checkbox.name = `col_${column}`;
        checkbox.value = column;
        checkbox.className = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
        
        // Check the checkbox if column is visible
        if (!tableColumnVisibility[table] || tableColumnVisibility[table][column]) {
            checkbox.checked = true;
        }
        
        const label = document.createElement('label');
        label.htmlFor = `col_${column}`;
        label.className = 'ml-2 text-sm text-gray-700 dark:text-gray-300 font-medium';
        label.textContent = column;
        
        columnContainer.appendChild(checkbox);
        columnContainer.appendChild(label);
        columnsGrid.appendChild(columnContainer);
    });
    
    form.appendChild(columnsGrid);
    modal.body.appendChild(form);
    
    // Add apply button to footer
    const applyButton = document.createElement('button');
    applyButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150';
    applyButton.textContent = 'Apply';
    applyButton.addEventListener('click', function() {
        // Update column visibility
        if (!tableColumnVisibility[table]) {
            tableColumnVisibility[table] = {};
        }
        
        columns.forEach(column => {
            const checkbox = document.getElementById(`col_${column}`);
            tableColumnVisibility[table][column] = checkbox.checked;
        });
        
        // Reload table data
        const tableSelect = document.getElementById('sqlTableSelect');
        if (tableSelect && tableSelect.value) {
            modal.close();
            loadTableData(tableSelect.value);
        }
    });
    
    // Add cancel button to footer
    const cancelButton = document.createElement('button');
    cancelButton.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function() {
        modal.close();
    });
    
    modal.footer.appendChild(cancelButton);
    modal.footer.appendChild(applyButton);
}

/**
 * Export table as SQL
 */
function exportTableAsSql() {
    sqlDebugLog('Exporting table as SQL');
    
    // Get the currently selected table
    const tableList = document.getElementById('sqlTableList');
    const activeTableItem = tableList ? tableList.querySelector('.bg-indigo-50, .dark\\:bg-indigo-900') : null;
    
    if (!activeTableItem) {
        triggerAlert('warning', 'Please select a table to export');
        return;
    }
    
    const table = activeTableItem.dataset.tableName;
    
    // Get export options
    const includeStructure = document.getElementById('exportIncludeStructure').checked;
    const includeData = document.getElementById('exportIncludeData').checked;
    const addDropTable = document.getElementById('exportAddDropTable').checked;
    
    if (!includeStructure && !includeData) {
        triggerAlert('warning', 'Please select at least one export option (structure or data)');
        return;
    }
    
    showLoadingState(`Exporting table ${table} as SQL...`);
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'export_sql',
        params: {
            table: table,
            includeStructure: includeStructure,
            includeData: includeData,
            addDropTable: addDropTable
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('SQL export result', result);
            
            if (result.success && result.sql) {
                // Download the SQL file
                downloadFile(result.sql, result.filename, 'text/plain');
                triggerAlert('success', `Table ${table} exported as SQL successfully!`);
            } else {
                triggerAlert('warning', 'Failed to export table: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('SQL export error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Export table as CSV
 */
function exportTableAsCsv() {
    sqlDebugLog('Exporting table as CSV');
    
    // Get the currently selected table
    const tableList = document.getElementById('sqlTableList');
    const activeTableItem = tableList ? tableList.querySelector('.bg-indigo-50, .dark\\:bg-indigo-900') : null;
    
    if (!activeTableItem) {
        triggerAlert('warning', 'Please select a table to export');
            return;
        }
        
    const table = activeTableItem.dataset.tableName;
    
    showLoadingState(`Exporting table ${table} as CSV...`);
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'export_csv',
        params: {
            table: table
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('CSV export result', result);
            
            if (result.success && result.csv) {
                // Download the CSV file
                downloadFile(result.csv, result.filename, 'text/csv');
                triggerAlert('success', `Table ${table} exported as CSV successfully!`);
            } else {
                triggerAlert('warning', 'Failed to export table: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('CSV export error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Export database as ZIP
 */
function exportDatabaseAsZip() {
    sqlDebugLog('Exporting database as ZIP');
    
    // Get export options
    const includeStructure = document.getElementById('exportIncludeStructure').checked;
    const includeData = document.getElementById('exportIncludeData').checked;
    const addDropTable = document.getElementById('exportAddDropTable').checked;
    const compressed = document.getElementById('exportCompressed').checked;
    
    if (!includeStructure && !includeData) {
        triggerAlert('warning', 'Please select at least one export option (structure or data)');
        return;
    }
    
    // Get the current database
    const databaseSelect = document.getElementById('sqlDatabaseSelect');
    if (!databaseSelect || !databaseSelect.value) {
        triggerAlert('warning', 'Please select a database first');
        return;
    }
    
    showLoadingState(`Exporting database ${databaseSelect.value} as ZIP...`);
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'export_zip',
        params: {
            includeStructure: includeStructure,
            includeData: includeData,
            addDropTable: addDropTable,
            compressed: compressed
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('ZIP export result', { success: result.success, filename: result.filename });
            
            if (result.success && result.zip) {
                // Convert base64 to binary
                const zipContent = base64ToArrayBuffer(result.zip);
                
                // Download the ZIP file
                downloadBinaryFile(zipContent, result.filename, 'application/zip');
                triggerAlert('success', 'Database exported as ZIP successfully!');
            } else {
                triggerAlert('warning', 'Failed to export database: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('ZIP export error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Helper function to download a text file
 */
function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Helper function to download a binary file
 */
function downloadBinaryFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

/**
 * Helper function to convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes.buffer;
}

/**
 * Clone a row
 */
function cloneRow(table, primaryKeyCol, primaryKeyVal) {
    sqlDebugLog(`Cloning row: ${table}, ${primaryKeyCol}=${primaryKeyVal}`);
    showLoadingState('Loading row data for cloning...');
    
    // First, get the row data
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'get_row',
        params: {
            table: table,
            primaryKeyCol: primaryKeyCol,
            primaryKeyVal: primaryKeyVal
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Get row for cloning result', result);
            
            if (result.success && result.row) {
                // Show add form with pre-filled data from the cloned row
                showCloneForm(table, result.row, result.columnTypes, primaryKeyCol);
            } else {
                triggerAlert('warning', 'Failed to load row data for cloning: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Get row for cloning error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Show clone form with pre-filled data
 */
function showCloneForm(table, rowData, columnTypes, primaryKeyCol) {
    sqlDebugLog('Showing clone form', { table, rowData });
    
    // Create modal
    const modal = createModal(`Clone Record in ${table}`, 'lg');
    
    // Create form
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.id = 'cloneRowForm';
    
    // Store the primary key column name in a data attribute
    form.dataset.primaryKeyCol = primaryKeyCol;
    
    // Add a note at the top
    const cloneNote = document.createElement('div');
    cloneNote.className = 'mb-4 p-3 bg-green-50 dark:bg-green-900 rounded-md text-sm text-green-700 dark:text-green-300';
    cloneNote.innerHTML = `
        <div class="flex items-start">
            <i class="fas fa-info-circle text-green-600 dark:text-green-400 mt-1 mr-2"></i>
            <div>
                <p>Creating a new record based on an existing one. Modify values as needed.</p>
                <p class="mt-1 font-medium">Note: Primary key fields will be auto-generated.</p>
            </div>
        </div>
    `;
    
    form.appendChild(cloneNote);
    
    // Create input fields for each column
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'grid grid-cols-1 gap-4';
    
    Object.keys(rowData).forEach(column => {
        const value = rowData[column];
        const columnType = columnTypes && columnTypes[column] ? columnTypes[column] : null;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        // Determine if this is the primary key
        const isPrimaryKey = column === primaryKeyCol;
        
        // Check if it's an auto-increment field
        const isAutoIncrement = columnType && columnType.EXTRA && columnType.EXTRA.includes('auto_increment');
        
        // Add a special class to primary key fields for easy identification
        if (isPrimaryKey) {
            formGroup.className += ' primary-key-field';
            formGroup.dataset.primaryKey = 'true';
        }
        
        const label = document.createElement('label');
        label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center justify-between';
        
        // Add primary key indicator to the label
        if (isPrimaryKey) {
            label.innerHTML = `
                ${column}
                <span class="text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded">
                    Primary Key
                </span>
            `;
        } else {
            label.textContent = column;
        }
        
        // Create appropriate input based on column type
        let input;
        
        // Get the data type from the column type object
        const dataType = columnType && columnType['DATA_TYPE'] ? columnType['DATA_TYPE'] : null;
        
        // For text type fields
        if (dataType && (
            dataType === 'varchar' || 
            dataType === 'text' || 
            dataType === 'char' ||
            dataType === 'enum' ||
            dataType === 'set' ||
            dataType.includes('text') ||
            dataType.includes('char')
        )) {
            // For longer text fields
            if (dataType === 'text' || dataType.includes('text') || (value && typeof value === 'string' && value.length > 100)) {
                input = document.createElement('textarea');
                input.rows = 3;
            } else {
                input = document.createElement('input');
                input.type = 'text';
            }
        }
        // For numeric fields
        else if (dataType && (
            dataType === 'int' ||
            dataType === 'tinyint' ||
            dataType === 'smallint' ||
            dataType === 'mediumint' ||
            dataType === 'bigint' ||
            dataType === 'decimal' || 
            dataType === 'float' || 
            dataType === 'double' ||
            dataType.includes('int') ||
            dataType.includes('decimal') ||
            dataType.includes('float') ||
            dataType.includes('double')
        )) {
            input = document.createElement('input');
            input.type = 'number';
            if (dataType === 'decimal' || dataType === 'float' || dataType === 'double' ||
                dataType.includes('decimal') || dataType.includes('float') || dataType.includes('double')) {
                input.step = '0.01';
            }
        }
        // For date fields
        else if (dataType && (dataType === 'date' || dataType.includes('date'))) {
            input = document.createElement('input');
            input.type = 'date';
            if (value) {
                // Format date for date input
                const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    input.value = dateMatch[1];
                }
            }
        }
        // For datetime fields
        else if (dataType && (dataType === 'datetime' || dataType.includes('datetime') || dataType === 'timestamp')) {
            input = document.createElement('input');
            input.type = 'datetime-local';
            if (value) {
                // Format datetime for datetime-local input
                const dateTimeMatch = value.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:?\d{0,2})/);
                if (dateTimeMatch) {
                    const datePart = dateTimeMatch[1];
                    const timePart = dateTimeMatch[2].substring(0, 5); // Get just HH:MM
                    input.value = `${datePart}T${timePart}`;
                }
            }
        }
        // Default to text input
        else {
            input = document.createElement('input');
            input.type = 'text';
        }
        
        // Set common attributes
        input.name = `new_${column}`;
        input.id = `clone_${column}`;
        input.className = 'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white';
        
        // Set value if not null and not the primary key
        if (value !== null && input.type !== 'date' && input.type !== 'datetime-local') {
            // For primary key, clear the value or set placeholder
            if (isPrimaryKey) {
                input.value = '';
                input.disabled = true;
                input.className += ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
                input.placeholder = 'Auto-generated';
                
                // Add a hidden input to mark this as a primary key field
                const hiddenInput = document.createElement('input');
                hiddenInput.type = 'hidden';
                hiddenInput.name = `is_primary_key_${column}`;
                hiddenInput.value = 'true';
                formGroup.appendChild(hiddenInput);
            } else {
                input.value = value;
            }
        }
        
        // If NULL is allowed, add a NULL checkbox
        const nullCheckbox = document.createElement('div');
        nullCheckbox.className = 'mt-1 flex items-center space-x-2';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `null_${column}`;
        checkbox.className = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
        
        // Check if value is NULL
        if (value === null) {
            checkbox.checked = true;
            input.disabled = true;
            input.className += ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
        }
        
        const nullLabel = document.createElement('label');
        nullLabel.className = 'text-xs text-gray-600 dark:text-gray-400';
        nullLabel.textContent = 'NULL';
        nullLabel.htmlFor = `null_${column}`;
        
        // Add event listener to toggle input disabled state
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                input.disabled = true;
                input.className = input.className + ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
            } else {
                // Don't enable primary key fields
                if (!isPrimaryKey) {
                    input.disabled = false;
                    input.className = input.className.replace(' bg-gray-100 dark:bg-gray-800 cursor-not-allowed', '');
                }
            }
        });
        
        nullCheckbox.appendChild(checkbox);
        nullCheckbox.appendChild(nullLabel);
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        
        // Only add NULL checkbox if the column is nullable and not a primary key
        if (columnType && columnType.IS_NULLABLE === 'YES' && !isPrimaryKey) {
            formGroup.appendChild(nullCheckbox);
        }
        
        // Add note for auto-increment fields
        if (isAutoIncrement) {
            const autoIncrementNote = document.createElement('div');
            autoIncrementNote.className = 'text-xs text-gray-500 mt-1';
            autoIncrementNote.textContent = 'Auto-increment field (value will be generated automatically)';
            formGroup.appendChild(autoIncrementNote);
        }
        
        fieldContainer.appendChild(formGroup);
    });
    
    form.appendChild(fieldContainer);
    modal.body.appendChild(form);
    
    // Add save button
    const saveButton = document.createElement('button');
    saveButton.className = 'bg-green-600 hover:bg-green-700 text-white font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150';
    saveButton.textContent = 'Create Clone';
    saveButton.addEventListener('click', function() {
        // Submit the form
        addClonedRow(table, form);
            hideModal(modal);
    });
    
    // Add cancel button
    const cancelButton = document.createElement('button');
    cancelButton.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function() {
        modal.close();
    });
    
    modal.footer.appendChild(cancelButton);
    modal.footer.appendChild(saveButton);
}

/**
 * Add a cloned row to the database
 */
function addClonedRow(table, form) {
    sqlDebugLog('Adding cloned row', { table });
    showLoadingState('Creating cloned record...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'add_row',
        params: {
            table: table,
            new_row: {}
        }
    };
    
    // Get primary key column from form data attribute
    const primaryKeyCol = form.dataset.primaryKeyCol || '';
    
    // Process form data
    const formData = new FormData(form);
    for (const [key, value] of formData.entries()) {
        // Skip checkboxes for NULL handling and primary key markers
        if (key.startsWith('null_') || key.startsWith('is_primary_key_')) continue;
        
        // Extract column name from input name (remove clone_ or new_ prefix)
        let columnName = key;
        if (columnName.startsWith('clone_')) {
            columnName = columnName.substring(6);
        } else if (columnName.startsWith('new_')) {
            columnName = columnName.substring(4);
        }
        
        // Skip primary key fields
        if (columnName === primaryKeyCol) {
            continue;
        }
        
        // Check if this field has a primary key marker
        if (form.querySelector(`input[name="is_primary_key_${columnName}"]`)) {
            continue;
        }
        
        // Check if NULL checkbox is checked
        const nullCheckbox = form.querySelector(`#null_${columnName}`);
        if (nullCheckbox && nullCheckbox.checked) {
            data.params.new_row[columnName] = null;
            continue;
        }
        
        // Handle datetime-local inputs - convert from YYYY-MM-DDThh:mm to YYYY-MM-DD hh:mm:ss
        const inputElement = form.elements[key];
        if (inputElement && inputElement.type === 'datetime-local' && value) {
            // Convert from YYYY-MM-DDThh:mm to YYYY-MM-DD hh:mm:ss
            const dateTime = new Date(value);
            if (!isNaN(dateTime.getTime())) {
                const formattedDate = dateTime.toISOString().slice(0, 19).replace('T', ' ');
                data.params.new_row[columnName] = formattedDate;
                continue;
            }
        }
        
        // Skip empty values for auto-increment fields or primary keys
        if (value === '' && (key.includes('_id') || columnName === primaryKeyCol)) {
            continue;
        }
        
        // Skip disabled inputs (which include primary keys)
        if (inputElement && inputElement.disabled) {
            continue;
        }
        
        data.params.new_row[columnName] = value;
    }
    
    sqlDebugLog('Cloned row data', data.params.new_row);
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Add cloned row result', result);
            
            if (result.success) {
                triggerAlert('success', 'Record cloned successfully!');
                // Reload the table data
                loadTableData(table);
            } else {
                triggerAlert('warning', 'Failed to clone record: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Add cloned row error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Show edit form for a row with column visibility control
 */
function showEditForm(table, primaryKeyCol, primaryKeyVal, rowData, columnTypes) {
    sqlDebugLog('Showing edit form', { table, primaryKeyCol, primaryKeyVal, rowData });
    
    // Create modal
    const modal = createModal(`Edit Record in ${table}`, 'lg');
    
    // Create form
    const form = document.createElement('form');
    form.className = 'space-y-4';
    form.id = 'editRowForm';
    
    // Add a note at the top about primary key
    const primaryKeyNote = document.createElement('div');
    primaryKeyNote.className = 'mb-4 p-3 bg-blue-50 dark:bg-blue-900 rounded-md text-sm text-blue-700 dark:text-blue-300';
    primaryKeyNote.innerHTML = `
        <div class="flex items-start">
            <i class="fas fa-info-circle text-blue-600 dark:text-blue-400 mt-1 mr-2"></i>
            <div>
                <p>Editing record where <span class="font-semibold">${primaryKeyCol} = ${primaryKeyVal}</span></p>
            </div>
        </div>
    `;
    
    form.appendChild(primaryKeyNote);
    
    // Create input fields for each column
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'grid grid-cols-1 gap-4';
    
    Object.keys(rowData).forEach(column => {
        const value = rowData[column];
        const columnType = columnTypes && columnTypes[column] ? columnTypes[column] : null;
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        const label = document.createElement('label');
        label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
        label.textContent = column;
        
        // Determine if this is the primary key (disabled)
        const isPrimaryKey = column === primaryKeyCol;
        
        // Create appropriate input based on column type
        let input;
        
        // Get the data type from the column type object
        const dataType = columnType && columnType['DATA_TYPE'] ? columnType['DATA_TYPE'] : null;
        
        // For text type fields
        if (dataType && (
            dataType === 'varchar' || 
            dataType === 'text' || 
            dataType === 'char' ||
            dataType === 'enum' ||
            dataType === 'set' ||
            dataType.includes('text') ||
            dataType.includes('char')
        )) {
            // For longer text fields
            if (dataType === 'text' || dataType.includes('text') || (value && typeof value === 'string' && value.length > 100)) {
                input = document.createElement('textarea');
                input.rows = 3;
            } else {
                input = document.createElement('input');
                input.type = 'text';
            }
        }
        // For numeric fields
        else if (dataType && (
            dataType === 'int' ||
            dataType === 'tinyint' ||
            dataType === 'smallint' ||
            dataType === 'mediumint' ||
            dataType === 'bigint' ||
            dataType === 'decimal' || 
            dataType === 'float' || 
            dataType === 'double' ||
            dataType.includes('int') ||
            dataType.includes('decimal') ||
            dataType.includes('float') ||
            dataType.includes('double')
        )) {
                input = document.createElement('input');
            input.type = 'number';
            if (dataType === 'decimal' || dataType === 'float' || dataType === 'double' ||
                dataType.includes('decimal') || dataType.includes('float') || dataType.includes('double')) {
                input.step = '0.01';
            }
        }
        // For date fields
        else if (dataType && (dataType === 'date' || dataType.includes('date'))) {
                input = document.createElement('input');
            input.type = 'date';
                if (value) {
                // Format date for date input
                const dateMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
                if (dateMatch) {
                    input.value = dateMatch[1];
                }
            }
        }
        // For datetime fields
        else if (dataType && (dataType === 'datetime' || dataType.includes('datetime') || dataType === 'timestamp')) {
                input = document.createElement('input');
            input.type = 'datetime-local';
            if (value) {
                // Format datetime for datetime-local input
                // Full regex to capture YYYY-MM-DD HH:MM:SS format
                const dateTimeMatch = value.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2}:?\d{0,2})/);
                if (dateTimeMatch) {
                    // Convert to format required by datetime-local input (YYYY-MM-DDThh:mm)
                    // Extract just the hours and minutes for the time part
                    const datePart = dateTimeMatch[1];
                    const timePart = dateTimeMatch[2].substring(0, 5); // Get just HH:MM
                    input.value = `${datePart}T${timePart}`;
                    
                    // Add a note about the original value
                    const noteSpan = document.createElement('span');
                    noteSpan.className = 'text-xs text-gray-500 block mt-1';
                    noteSpan.textContent = `Original value: ${value}`;
                    
                    // We'll append this note after the input element
                    setTimeout(() => {
                        if (input.parentNode) {
                            input.parentNode.insertBefore(noteSpan, input.nextSibling);
                        }
                    }, 0);
        } else {
                    // If the regex didn't match, just use the value as is
                    input.value = value;
                }
            }
        }
        // For time fields
        else if (dataType && (dataType === 'time' || dataType.includes('time'))) {
            input = document.createElement('input');
            input.type = 'time';
        }
        // Default to text input
        else {
            input = document.createElement('input');
            input.type = 'text';
        }
        
        // Set common attributes
        input.name = column;
        input.id = `edit_${column}`;
        input.className = 'bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white';
        
        // Set value if not null
        if (value !== null && input.type !== 'date' && input.type !== 'datetime-local') {
            input.value = value;
        }
        
        // Disable if primary key
        if (isPrimaryKey) {
            input.disabled = true;
            input.className += ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
        }
        
        // If NULL is allowed, add a NULL checkbox
        const nullCheckbox = document.createElement('div');
        nullCheckbox.className = 'mt-1 flex items-center space-x-2';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `null_${column}`;
        checkbox.className = 'h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded';
        
        // Check if value is NULL
        if (value === null) {
            checkbox.checked = true;
            input.disabled = true;
            input.className += ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
        }
        
        const nullLabel = document.createElement('label');
        nullLabel.className = 'text-xs text-gray-600 dark:text-gray-400';
        nullLabel.textContent = 'NULL';
        nullLabel.htmlFor = `null_${column}`;
        
        // Add event listener to toggle input disabled state
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                input.disabled = true;
                input.className = input.className + ' bg-gray-100 dark:bg-gray-800 cursor-not-allowed';
            } else {
                if (!isPrimaryKey) {
                    input.disabled = false;
                    input.className = input.className.replace(' bg-gray-100 dark:bg-gray-800 cursor-not-allowed', '');
                }
            }
        });
        
        nullCheckbox.appendChild(checkbox);
        nullCheckbox.appendChild(nullLabel);
        
        formGroup.appendChild(label);
        formGroup.appendChild(input);
        
        // Only add NULL checkbox if this is not the primary key
        if (!isPrimaryKey) {
            formGroup.appendChild(nullCheckbox);
        }
        
        fieldContainer.appendChild(formGroup);
    });
    
    form.appendChild(fieldContainer);
    modal.body.appendChild(form);
    
    // Add save button
    const saveButton = document.createElement('button');
    saveButton.className = 'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150';
    saveButton.textContent = 'Save Changes';
    saveButton.addEventListener('click', function() {
        // Get form data
        updateRow(table, primaryKeyCol, primaryKeyVal, form);
        hideModal(modal);
    });
    
    // Add cancel button
    const cancelButton = document.createElement('button');
    cancelButton.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded text-sm px-5 py-2.5 text-center focus:outline-none transition duration-150 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', function() {
        modal.close();
    });
    
    modal.footer.appendChild(cancelButton);
    modal.footer.appendChild(saveButton);
}

/**
 * Search all columns in a table
 */
function searchTableAllColumns(table, searchValue) {
    sqlDebugLog(`Searching in all columns of table ${table} for: ${searchValue}`);
    
    // Reset to page 1 when performing a new search
    loadTableData(table, 1, 50, null, 'ASC', searchValue);
}

/**
 * Perform a global search across all databases and tables
 */
function globalDatabaseSearch(searchQuery, limit = 10) {
    sqlDebugLog(`Performing global database search for: ${searchQuery}`);
    
    if (!searchQuery.trim()) {
        triggerAlert('warning', 'Please enter a search term');
        return;
    }
    
    showLoadingState('Searching all databases...');
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'global_search',
        params: {
            searchQuery: searchQuery,
            limit: limit
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            
            if (result.success) {
                renderGlobalSearchResults(searchQuery, result.results);
            } else {
                triggerAlert('warning', 'Search failed: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Render global search results
 */
function renderGlobalSearchResults(searchQuery, results) {
    // Get the query result container to display results
    const container = document.getElementById('sqlQueryResult');
    if (!container) {
        triggerAlert('warning', 'Results container not found');
        return;
    }
    
    // Clear previous results
    clearQueryResult();
    
    // Count total matches
    let totalDatabases = 0;
    let totalTables = 0;
    let totalMatches = 0;
    
    Object.keys(results).forEach(db => {
        totalDatabases++;
        Object.keys(results[db]).forEach(table => {
            totalTables++;
            totalMatches += results[db][table].total_matches;
        });
    });
    
    if (totalMatches === 0) {
        container.innerHTML = `
            <div class="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div class="flex items-center mb-4">
                    <div class="h-10 w-10 flex items-center justify-center bg-yellow-100 dark:bg-yellow-900 rounded-full text-yellow-500 dark:text-yellow-300">
                        <i class="fas fa-search fa-lg"></i>
                    </div>
                    <div class="ml-4">
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">No results found</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-300">Your search for "${searchQuery}" did not match any content</p>
                    </div>
                </div>
            </div>
        `;
        return;
    }
    
    // Create results container
    const resultsWrapper = document.createElement('div');
    resultsWrapper.className = 'global-search-results space-y-6';
    
    // Add search summary header
    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'bg-indigo-50 dark:bg-indigo-900 p-4 rounded-lg';
    summaryHeader.innerHTML = `
        <div class="flex items-center">
            <div class="h-10 w-10 flex items-center justify-center bg-indigo-100 dark:bg-indigo-800 rounded-full text-indigo-500 dark:text-indigo-300">
                <i class="fas fa-search fa-lg"></i>
            </div>
            <div class="ml-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Search Results</h3>
                <p class="text-sm text-gray-600 dark:text-gray-300">
                    Found <span class="font-semibold">${totalMatches}</span> matches for "<span class="font-semibold">${searchQuery}</span>"
                    in <span class="font-semibold">${totalTables}</span> tables across <span class="font-semibold">${totalDatabases}</span> databases
                </p>
            </div>
        </div>
    `;
    
    resultsWrapper.appendChild(summaryHeader);
    
    // Create an accordion for each database
    Object.keys(results).forEach(database => {
        const dbTables = results[database];
        const dbCard = document.createElement('div');
        dbCard.className = 'database-card border dark:border-gray-700 rounded-lg overflow-hidden';
        
        // Count tables and matches in this database
        const dbTableCount = Object.keys(dbTables).length;
        let dbMatchCount = 0;
        Object.keys(dbTables).forEach(table => {
            dbMatchCount += dbTables[table].total_matches;
        });
        
        // Database header
        const dbHeader = document.createElement('div');
        dbHeader.className = 'database-header bg-gray-100 dark:bg-gray-800 px-4 py-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700';
        dbHeader.innerHTML = `
            <div class="flex justify-between items-center">
                <div class="flex items-center">
                    <i class="fas fa-database mr-2 text-indigo-500"></i>
                    <h4 class="font-semibold text-gray-900 dark:text-white">${database}</h4>
                </div>
                <div class="flex items-center">
                    <span class="bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 text-xs font-semibold px-2.5 py-0.5 rounded mr-2">
                        ${dbTableCount} tables
                    </span>
                    <span class="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                        ${dbMatchCount} matches
                    </span>
                    <i class="fas fa-chevron-down ml-3 transform transition-transform duration-200"></i>
                </div>
            </div>
        `;
        
        // Toggle database tables visibility when clicking the header
        dbHeader.addEventListener('click', () => {
            const content = dbHeader.nextElementSibling;
            const chevron = dbHeader.querySelector('.fa-chevron-down');
            
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
                chevron.classList.remove('rotate-180');
            } else {
                content.style.maxHeight = content.scrollHeight + 'px';
                chevron.classList.add('rotate-180');
            }
        });
        
        // Database content (tables)
        const dbContent = document.createElement('div');
        dbContent.className = 'database-content overflow-hidden transition-all duration-300';
        dbContent.style.maxHeight = '0';
        
        // For each table in this database
        Object.keys(dbTables).forEach(tableName => {
            const tableData = dbTables[tableName];
            const matches = tableData.matches;
            const totalMatches = tableData.total_matches;
            const hasMore = tableData.has_more;
            
            // Table section
            const tableSection = document.createElement('div');
            tableSection.className = 'table-section border-t dark:border-gray-700';
            
            // Table header
            const tableHeader = document.createElement('div');
            tableHeader.className = 'table-header bg-gray-50 dark:bg-gray-900 px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800';
            tableHeader.innerHTML = `
                <div class="flex justify-between items-center">
                    <div class="flex items-center">
                        <i class="fas fa-table mr-2 text-blue-500"></i>
                        <h5 class="font-medium text-gray-800 dark:text-gray-200">${tableName}</h5>
                    </div>
                    <div class="flex items-center">
                        <span class="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs font-semibold px-2.5 py-0.5 rounded">
                            ${totalMatches} matches
                        </span>
                        <i class="fas fa-chevron-down ml-3 transform transition-transform duration-200"></i>
                    </div>
                </div>
            `;
            
            // Toggle table matches visibility
            tableHeader.addEventListener('click', () => {
                const content = tableHeader.nextElementSibling;
                const chevron = tableHeader.querySelector('.fa-chevron-down');
                
                if (content.style.maxHeight) {
                    content.style.maxHeight = null;
                    chevron.classList.remove('rotate-180');
                } else {
                    content.style.maxHeight = content.scrollHeight + 'px';
                    chevron.classList.add('rotate-180');
                }
            });
            
            // Table matches content
            const tableContent = document.createElement('div');
            tableContent.className = 'table-content overflow-hidden transition-all duration-300';
            tableContent.style.maxHeight = '0';
            
            // Create a scrollable container for the matches
            const matchesContainer = document.createElement('div');
            matchesContainer.className = 'matches-container overflow-x-auto';
            
            // Create a table to display the matches
            const matchesTable = document.createElement('table');
            matchesTable.className = 'min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm';
            
            // Create table header with column names
            const tableHead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            // Get column names from the first match
            const columnNames = tableData.columns;
            columnNames.forEach(column => {
                const th = document.createElement('th');
                th.className = 'px-4 py-2 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider';
                th.textContent = column;
                headerRow.appendChild(th);
            });
            
            tableHead.appendChild(headerRow);
            matchesTable.appendChild(tableHead);
            
            // Create table body with matches
            const tableBody = document.createElement('tbody');
            tableBody.className = 'bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800';
            
            matches.forEach((match, index) => {
                const row = document.createElement('tr');
                row.className = index % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-800';
                
                // Add cells for each column
                columnNames.forEach(column => {
                    const cell = document.createElement('td');
                    cell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400';
                    
                    const value = match.row[column];
                    
                    // Highlight matching text if this column contains the match
                    if (match.matching_columns.includes(column) && value !== null && typeof value === 'string') {
                        // Create a safe version of the search query for regex
                        const safeQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp('(' + safeQuery + ')', 'gi');
                        cell.innerHTML = value.replace(regex, '<span class="bg-yellow-200 dark:bg-yellow-700">$1</span>');
                    } else {
                        cell.textContent = value === null ? 'NULL' : value;
                    }
                    
                    row.appendChild(cell);
                });
                
                tableBody.appendChild(row);
            });
            
            matchesTable.appendChild(tableBody);
            matchesContainer.appendChild(matchesTable);
            
            // Add "more results" note if applicable
            if (hasMore) {
                const moreNote = document.createElement('div');
                moreNote.className = 'p-2 text-center text-sm text-gray-500 dark:text-gray-400 italic';
                moreNote.textContent = `Showing ${matches.length} of ${totalMatches} matches`;
                matchesContainer.appendChild(moreNote);
            }
            
            // Link to view table
            const viewTableLink = document.createElement('div');
            viewTableLink.className = 'p-3 text-center border-t dark:border-gray-700';
            viewTableLink.innerHTML = `
                <button class="view-table-btn text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300">
                    <i class="fas fa-external-link-alt mr-1"></i> View full table
                </button>
            `;
            
            // Add click event to load this database and table
            viewTableLink.querySelector('.view-table-btn').addEventListener('click', () => {
                selectDatabase(database);
                setTimeout(() => {
                    // Try to find and click on the table in the sidebar
                    const tableItems = document.querySelectorAll('.table-item');
                    for (let i = 0; i < tableItems.length; i++) {
                        if (tableItems[i].dataset.tableName === tableName) {
                            tableItems[i].click();
                            break;
                        }
                    }
                }, 500); // Give time for the database to load
            });
            
            tableContent.appendChild(matchesContainer);
            tableContent.appendChild(viewTableLink);
            tableSection.appendChild(tableHeader);
            tableSection.appendChild(tableContent);
            dbContent.appendChild(tableSection);
        });
        
        dbCard.appendChild(dbHeader);
        dbCard.appendChild(dbContent);
        resultsWrapper.appendChild(dbCard);
    });
    
    container.appendChild(resultsWrapper);
}

/**
 * Export all databases as a ZIP file
 */
function exportAllDatabasesAsZip() {
    sqlDebugLog('Exporting all databases as ZIP');
    showLoadingState('Exporting all databases...');
    
    // Get export options
    const includeStructure = document.getElementById('exportIncludeStructure')?.checked ?? true;
    const includeData = document.getElementById('exportIncludeData')?.checked ?? true;
    const addDropTable = document.getElementById('exportAddDropTable')?.checked ?? true;
    const compressed = document.getElementById('exportCompressed')?.checked ?? true;
    
    const data = {
        csrf: getCsrfToken(),
        action: 'sql_explorer',
        sql_action: 'export_all_databases_zip',
        params: {
            includeStructure: includeStructure,
            includeData: includeData,
            addDropTable: addDropTable,
            compressed: compressed
        }
    };
    
    sqlSendRequest(data)
        .then(result => {
            hideLoadingState();
            sqlDebugLog('Export all databases result', result);
            
            if (result.success && result.zip) {
                // Display success message with download link
                triggerAlert('success', `All databases exported successfully (${formatFileSize(result.filesize)})`);
                
                // Decode base64 and download
                const zipContent = base64ToArrayBuffer(result.zip);
                downloadBinaryFile(zipContent, result.filename, 'application/zip');
            } else {
                triggerAlert('warning', 'Failed to export databases: ' + (result.error || 'Unknown error'));
            }
        })
        .catch(error => {
            hideLoadingState();
            sqlDebugLog('Export all databases error', error);
            triggerAlert('warning', 'Error: ' + error);
        });
}

/**
 * Format file size in bytes to a human-readable string
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
