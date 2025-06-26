function initializeFileManager(csrf, currentDir, isEnc, encryptionKey) {
    const key = isEnc === '1' ? (encryptionKey) : "null";


    // Event delegation for rename button
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-edit')) {
            const oldName = event.target.dataset.file;
            renameFile(oldName, csrf, currentDir, key, isEnc);
        }
    });

    // Event delegation for delete button
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-trash-alt')) {
            const filePath = event.target.dataset.file;
            if (filePath) {
                deleteFile(filePath, csrf, currentDir, key, isEnc);
            }
        }
    });


    // Event delegation for directory navigation
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('directory-link')) {
            event.preventDefault();
            const newDir = event.target.dataset.path;
            if (newDir && newDir !== currentDir) {
                currentDir = newDir;
                
                // Get current items per page setting
                let itemLimitElement = document.getElementById('itemLimit');
                let itemsPerPage = itemLimitElement ? itemLimitElement.value : '50';
                
                loadDirectory(currentDir, 1, csrf, key, isEnc, itemsPerPage);
            }
        }
    });

    // Event delegation for table row clicks to toggle checkboxes
    document.addEventListener('click', function (event) {
        // Find if we clicked on a table cell (td) that's part of the file list
        const td = event.target.closest('td');
        if (!td) return;
        
        // Skip if we clicked directly on a checkbox, link, or button
        if (event.target.tagName === 'INPUT' || 
            event.target.tagName === 'A' || 
            event.target.tagName === 'BUTTON' ||
            event.target.tagName === 'I' ||
            event.target.tagName === 'TH') {
            return;
        }
        
        // Skip if we clicked on a table header or if not in the fileList tbody
        if (td.closest('thead') || !td.closest('#fileList')) {
            return;
        }
        
        // Find the parent row
        const tr = td.closest('tr');
        if (!tr) return;
        
        // Find the checkbox in this row
        const checkbox = tr.querySelector('.file-checkbox');
        if (!checkbox) return;
        
        // Toggle the checkbox
        checkbox.checked = !checkbox.checked;
        
        // Update the selected files state
        if (checkbox.dataset.file) {
            updateSelectedFiles(checkbox.dataset.file, checkbox.checked);
            
            // Add visual feedback
            if (checkbox.checked) {
                tr.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
            } else {
                tr.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
            }
        }
    });

   

    // Load the initial directory
    loadDirectory(currentDir, 1, csrf, key, isEnc);
}


function sendRequest(data, key, isEnc) {
    // Ensure CSRF token is included in every request
    if (!data.csrf) {
        throw new Error('CSRF token is missing.');
    }
 
    const jsonData = JSON.stringify(data);
    
    // Make sure key is properly formatted for CryptoJS
    let encryptionKey = key;
    if (isEnc === '1' && typeof key === 'string') {
        encryptionKey = CryptoJS.enc.Utf8.parse(key);
    }
    
    const encryptedData = (isEnc === '1') ? encrypt(jsonData, encryptionKey) : jsonData;
 
    return new Promise((resolve, reject) => {
        console.log('Sending request with encryption:', isEnc === '1');
        $.post('', encryptedData)
            .done(response => {
                try {
                    console.log('Raw response:', response ? response.substring(0, 50) + (response.length > 50 ? '...' : '') : '<empty>');
                    
                    let decryptedResponse = response;
                    if (isEnc === '1') {
                        try {
                            decryptedResponse = decrypt(response, encryptionKey);
                            console.log('Decryption succeeded');
                        } catch (decryptError) {
                            console.error('Decryption failed:', decryptError);
                            // Fall back to using the raw response
                        }
                    }

                    // If response is empty string we just resolve with empty string.
                    if (decryptedResponse === '') {
                        resolve('');
                        return;
                    }

                    // Attempt to parse JSON. If it fails we treat response as plain text.
                    let parsed;
                    try {
                        parsed = JSON.parse(decryptedResponse);
                    } catch (parseErr) {
                        // Not JSON – return plain string
                        console.warn('Response is not valid JSON, returning plain text.');
                        resolve(decryptedResponse);
                        return;
                    }

                    // Handle standard JSON response structure
                    if (parsed && parsed.error) {
                        reject(new Error(parsed.error));
                    } else {
                        resolve(parsed);
                    }
                } catch (error) {
                    console.error('Unhandled error while processing response:', error);
                    console.error('Response text:', response);
                    reject(new Error('Failed to process server response.'));
                    triggerAlert('warning', 'Failed to process server response');
                }
            })
            .fail((jqXHR, textStatus, errorThrown) => {
                console.error('Network error:', textStatus, errorThrown);
                console.error('Status code:', jqXHR.status);
                console.error('Response text:', jqXHR.responseText);
                reject(new Error(`Network error: ${textStatus} - ${errorThrown || jqXHR.status}`));
                triggerAlert('warning', `Request failed: ${textStatus} ${errorThrown || ''}`);
            });
    });
}
function showDialog(title, inputLabel, confirmButtonText, oldName, onConfirm) {
    const isDarkMode = document.documentElement.classList.contains('dark');

    Swal.fire({
        title: title,
        input: 'text',
        inputLabel: inputLabel,
        inputValue: oldName,
        showCancelButton: true,
        confirmButtonText: confirmButtonText,
        cancelButtonText: 'Cancel',
        customClass: {
            popup: isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900',
            confirmButton: isDarkMode ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded' : 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded',
            cancelButton: isDarkMode ? 'bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded' : 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded',
            input: isDarkMode ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-900 border-gray-300'
        },

    }).then((result) => {
        if (result.isConfirmed) {
            const newName = result.value.trim();
            onConfirm(newName); // Execute the callback with the new value
        }
    });
}
// confirm 
function showConfirmation(title, text, confirmButtonText, onConfirm) {
    const isDarkMode = document.documentElement.classList.contains('dark');

    Swal.fire({
        title: title,
        text: text,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: confirmButtonText,
        cancelButtonText: 'Cancel',
        customClass: {
            popup: isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900',
            confirmButton: isDarkMode ? 'bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded' : 'bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded',
            cancelButton: isDarkMode ? 'bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded' : 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            onConfirm(); // Execute the callback if the user confirms
        }
    });
}
function renameFile(oldName, csrf, currentDir, key, isEnc) {
     showDialog(
        'Rename File',  
        'Enter the new name for the file:',  
        'Rename', 
        oldName,  
        (newName) => {
            // Callback function executed when the user confirms
            if (newName && newName.trim() !== oldName) {
                sendRequest({ csrf, action: 'rename', oldName, newName: newName.trim(), dir: currentDir }, key, isEnc)
                    .then(() => {
                        triggerAlert('success', 'File renamed successfully!');
                        loadDirectory(currentDir, 1, csrf, key, isEnc); // Reload directory
                    })
                    .catch(error => {
                        triggerAlert('warning', error); // Show error message
                        console.error('Error renaming file:', error); // Log error for debugging
                    });
            }
        }
    );
}
 


function deleteFile(fileName, csrf, currentDir, key, isEnc) {
    console.log("currentDir : "+currentDir);
    showConfirmation(
        'Delete File', // Title
        `Are you sure you want to delete "${fileName}"?`, // Text
        'Delete', // Confirm button text
        () => {
            // Callback function executed when the user confirms
            sendRequest({ csrf, action: 'delete', file: fileName, dir: currentDir }, key, isEnc)
                .then(() => {
                    triggerAlert('success', `"${fileName}" has been deleted successfully!`);
                    loadDirectory(currentDir, 1, csrf, key, isEnc); // Reload directory
                })
                .catch(error => {
                    triggerAlert('warning', error); // Show error message
                    console.error('Error deleting file:', error); // Log error for debugging
                });
        }
    );
}
// function handleDirectoryResponse(response, isEnc, key, dir, page, csrf) {

//     let decryptedResponse = isEnc === '1' ? decrypt(response, key) : response;
//     console.log(key);
//     const result = JSON.parse(decryptedResponse);

//     try {


//         // console.log(response);


//         if (result.error) {
//             triggerAlert('warning', result.error);
//         } else {
//             fileManagerState.totalPages = result.totalPages;

//             if (page === 1) {
//                 fileManagerState.files = result.files; // Reset files for the first page
//                 renderFiles(result.files, dir, csrf, key, isEnc);
//             } else {
//                 fileManagerState.files = fileManagerState.files.concat(result.files); // Append new files
//                 appendFiles(result.files, dir, csrf, key, isEnc);
//             }

//         }

//     } catch (error) {
//         // triggerAlert('warning', 'An error occurred while loading the directory.');
//         // Log detailed error information to the console for debugging
//         // console.error('POST Request Failed:',error);
//         console.error(error);


//         // console.error('Response Text:', error.message);
//     }
// }
function progr() {
    if (isLoading) return;
    isLoading = true;
    NProgress.start();

}
function dprogr() {
    NProgress.done();
    isLoading = false;

}
function loadDirectory(dir, page, csrf, key, isEnc, itemsPerPage) {
    progr();
    
    // Get default items per page from localStorage if not provided
    if (!itemsPerPage) {
        const itemLimitElement = document.getElementById('itemLimit');
        if (itemLimitElement && itemLimitElement.value) {
            itemsPerPage = itemLimitElement.value;
        } else {
        const defaultItemsPerPage = localStorage.getItem('default-items-per-page');
            itemsPerPage = defaultItemsPerPage || '50';
        }
    }
    
    // For numeric values, ensure it's a valid number
    if (itemsPerPage !== 'all' && itemsPerPage !== 'infinity') {
        const parsedValue = parseInt(itemsPerPage, 10);
        if (isNaN(parsedValue) || parsedValue <= 0) {
            itemsPerPage = '50'; // Default to 50 if invalid
        }
    }
     
    const data = {
        csrf: csrf,
        action: 'list',
        dir: dir,
        page: page,
        itemsPerPage: itemsPerPage
    };
    const jsonData = JSON.stringify(data);

    const encryptedData = isEnc === '1' ? encrypt(jsonData, key) : jsonData;

    $.post('', encryptedData, function (response) {
        handleDirectoryResponse(response, isEnc, key, dir, page, csrf);
        dprogr();
    }).fail(function () {
        triggerAlert('warning', 'An error occurred while loading the directory.');
        dprogr();
    });
}

function handleDirectoryResponse(response, isEnc, key, dir, page, csrf) {
    try {
        let decryptedResponse = isEnc === '1' ? decrypt(response, key) : response;
        const result = JSON.parse(decryptedResponse);

        // Ensure fileManagerState is initialized
        if (!window.fileManagerState) {
            window.fileManagerState = {
                files: [],
                totalPages: 1,
                currentPage: 1,
                totalItems: 0,
                itemsPerPage: 50,
                currentSort: { column: 'name', direction: 'asc' },
                selectedFiles: []
            };
        }

        if (result.error) {
            triggerAlert('warning', result.error);
        } else {
            // Update fileManagerState
            window.fileManagerState.files = result.files;
            window.fileManagerState.totalPages = result.totalPages;
            window.fileManagerState.currentPage = page;
            window.fileManagerState.currentDir = dir;
            window.fileManagerState.totalItems = result.totalItems || 0;
            
            // Get current items per page from the dropdown
            const itemLimitElement = document.getElementById('itemLimit');
            if (itemLimitElement) {
                const itemsPerPage = itemLimitElement.value;
                window.fileManagerState.itemsPerPage = itemsPerPage;
            }

            // Update current directory in global state
            if (typeof window.updateCurrentPath === 'function') {
                window.updateCurrentPath(dir);
            }

            // Render files
            renderFiles(result.files, dir, csrf, key, isEnc);
            
            // Update breadcrumbs
            if (typeof window.updateBreadcrumbs === 'function') {
                window.updateBreadcrumbs(dir);
            }
            
            // Update active tab path if available
            if (typeof window.updateActiveTabPath === 'function') {
                window.updateActiveTabPath(dir);
                
                // Save tabs state to localStorage after path update
                if (typeof window.saveTabsToLocalStorage === 'function') {
                    window.saveTabsToLocalStorage();
                }
            }
            
            // Update footer with item stats
            updateFileTableFooter();
        }
    } catch (error) {
        triggerAlert('warning', 'Failed to parse server response.');
        console.error('Error parsing directory response:', error);
    }
}

function createFileRow(file, currentDir, csrf, key, isEnc) {
    let iconColorClass = 'text-blue-600 dark:text-blue-400';
    
    // Determine permission colors based on actual file access
    let permsColor;
    let permsTooltip;
    let rowBgClass;
    
    // Use file.wr to determine if file is writable
    if (file.wr) {
        permsColor = 'text-green-600 dark:text-green-400';
        permsTooltip = 'Writable';
        rowBgClass = 'bg-green-50 dark:bg-green-900/10';
    } 
    // If not writable but can read (assuming we can read it since we're seeing it)
    else if (file.perms && file.perms.includes('r')) {
        permsColor = 'text-yellow-600 dark:text-yellow-400';
        permsTooltip = 'Read Only';
        rowBgClass = 'bg-yellow-50 dark:bg-yellow-900/10';
    } 
    // No read/write permissions
    else {
        permsColor = 'text-blue-600 dark:text-blue-400';
        permsTooltip = 'No Read/Write Access';
        rowBgClass = 'bg-blue-50 dark:bg-blue-900/10';
    }
    
    let permsIcon = '';
    
    // Set icon color based on file type
    if (file.is_dir) {
        iconColorClass = 'text-yellow-600 dark:text-yellow-400';
    } else if (file.name.endsWith('.php') || file.name.endsWith('.py') || file.name.endsWith('.js')) {
        iconColorClass = 'text-green-600 dark:text-green-400';
    } else if (file.name.endsWith('.zip') || file.name.endsWith('.tar') || file.name.endsWith('.gz')) {
        iconColorClass = 'text-amber-600 dark:text-amber-400';
    }

    // Create full path for this file
    const fullPath = `${currentDir}/${file.name}`;
    
    // Create a unique ID for this file's checkbox
    const checkboxId = `file-checkbox-${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Check if this file is in the selectedFiles array (by full path)
    const isSelected = window.fileManagerState && 
                      window.fileManagerState.selectedFiles && 
                      (window.fileManagerState.selectedFiles.includes(fullPath) || 
                       window.fileManagerState.selectedFiles.includes(file.name));
    
    const checkedAttr = isSelected ? 'checked' : '';
    
    // Create row class with permission-based colors
    let rowClass = 'border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150';
    
    // If selected, use the selection color instead of permission color
    if (isSelected) {
        rowClass += ' bg-blue-50 dark:bg-blue-900/20';
    } else {
        rowClass += ' ' + rowBgClass;
    }

    return `
        <tr class="${rowClass}" data-file="${file.name}" data-full-path="${fullPath}">
            <td class="py-1 px-3 text-left">
                <input type="checkbox" id="${checkboxId}" 
                    class="file-checkbox w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600" 
                    data-file="${file.name}" 
                    data-full-path="${fullPath}" 
                    ${checkedAttr} 
                />
            </td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">
                <div class="flex items-center">
                    <i class="fas ${file.icon} mr-2 ${iconColorClass}"></i>
                ${file.is_dir
                        ? `<a href="#" class="font-medium directory-link hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150" data-path="${fullPath}">${file.name}</a>`
                        : `<a href="#" class="font-medium file-link hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-150" data-file="${fullPath}">${file.name}</a>`
                }
                </div>
            </td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">${file.size}</td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">${file.mtime}</td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">${file.owner}</td>
            <td class="py-3 px-6 text-left" title="${permsTooltip}">
                ${formatPermissions(file.perms, file.wr)}
            </td>
            <td class="py-3 px-6 text-left text-gray-900 dark:text-gray-300">
                <div class="flex space-x-2">
                ${!file.is_dir
                        ? `<button class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150">
                              <i class="fas fa-edit text-yellow-600 dark:text-yellow-400" title="Rename" data-file="${file.name}"></i>
                           </button>
                           <button class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150">
                              <i class="fas fa-trash-alt text-red-600 dark:text-red-400" title="Delete" data-file="${fullPath}"></i>
                           </button>
                           <button class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150">
                       <i class="fas fa-download text-green-600 dark:text-green-400" title="Download" data-file="${currentDir + '/' + file.name}"></i>

                           </button>`
                        : `<button class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150">
                              <i class="fas fa-edit text-yellow-600 dark:text-yellow-400" title="Rename" data-file="${file.name}"></i>
                           </button>
                           <button class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150">
                              <i class="fas fa-trash-alt text-red-600 dark:text-red-400" title="Delete" data-file="${fullPath}"></i>
                           </button>`
                }
                </div>
            </td>
        </tr>
    `;
}
function triggerAlert(type, message) {
    document.dispatchEvent(new CustomEvent('show-alert', {
        detail: { type: type, message: message }
    }));
}

function encrypt(message, key) {
    return CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(message), key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    }).toString();
}

function decrypt(encryptedMessage, key) {
    return CryptoJS.AES.decrypt(encryptedMessage, key, {
        mode: CryptoJS.mode.ECB,
        padding: CryptoJS.pad.Pkcs7
    }).toString(CryptoJS.enc.Utf8);
}

/**
 * Search files based on a query string
 * @param {Array} files - Array of file objects to search through
 * @param {string} query - Search query string
 * @returns {Array} - Filtered array of files matching the query
 */
function searchFiles(files, query) {
    if (!files || !Array.isArray(files)) {
        console.error('Invalid files array provided to searchFiles');
        return [];
    }
    
    // If no query, return all files
    if (!query || query.trim() === '') {
        return files;
    }
    
    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();

    // Filter files based on the search query
    return files.filter(file => {
        if (!file) return false;
        
        // Search in all available properties
        return (
            // Always search in name
            (file.name && file.name.toLowerCase().includes(normalizedQuery)) ||
            // Search in other properties if they exist
            (file.owner && file.owner.toLowerCase().includes(normalizedQuery)) ||
            (file.perms && file.perms.toLowerCase().includes(normalizedQuery)) ||
            (file.size && file.size.toString().toLowerCase().includes(normalizedQuery)) ||
            (file.mtime && file.mtime.toLowerCase().includes(normalizedQuery))
        );
    });
}

/**
 * Update renderFiles to use the new searchFiles function
 * @param {Array} files - Array of file objects to render
 * @param {string} currentDir - Current directory
 * @param {string} csrf - CSRF token
 * @param {object} key - Encryption key
 * @param {string} isEnc - Whether encryption is enabled
 */
function renderFiles(files, currentDir, csrf, key, isEnc) {
    // Get search query from the search bar
    const searchBar = document.getElementById('searchBar') || document.querySelector('#searchBar');
    const searchQuery = searchBar ? searchBar.value.toLowerCase().trim() : '';
    
     
    // Get the file list element
    const fileList = document.getElementById('fileList');
    if (!fileList) {
        console.error('File list element not found');
        return;
    }
    
    // If no files, show a message
    if (!files || files.length === 0) {
        fileList.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No files found</td></tr>';
        // Update footer with zero counts
        updateFileTableFooter();
        return;
    }

    // Filter files using the searchFiles function
    const filteredFiles = searchFiles(files, searchQuery);
 
    // Generate HTML for filtered files
    if (filteredFiles.length === 0) {
        fileList.innerHTML = '<tr><td colspan="7" class="py-4 text-center text-gray-500">No matching files found</td></tr>';
    } else {
        fileList.innerHTML = filteredFiles.map(file => createFileRow(file, currentDir, csrf, key, isEnc)).join('');
    }

    // Add event listeners for checkboxes
    addCheckboxEventListeners();
    
    // Update the table footer with item counts
    updateFileTableFooter();
}

/**
 * Update appendFiles to use the new searchFiles function
 * @param {Array} files - Array of file objects to append
 * @param {string} currentDir - Current directory
 * @param {string} csrf - CSRF token
 * @param {object} key - Encryption key
 * @param {string} isEnc - Whether encryption is enabled
 */
function appendFiles(files, currentDir, csrf, key, isEnc) {
    // Get search query from the search bar
    const searchBar = document.getElementById('searchBar') || document.querySelector('#searchBar');
    const searchQuery = searchBar ? searchBar.value.toLowerCase().trim() : '';
    
    console.log('Appending files with search query:', searchQuery);
    
    // Get the file list element
    const fileList = document.getElementById('fileList');
    if (!fileList) {
        console.error('File list element not found');
        return;
    }
    
    // If no files, do nothing
    if (!files || files.length === 0) {
        return;
    }

    // Filter files using the searchFiles function
    const filteredFiles = searchFiles(files, searchQuery);

    // Generate HTML for filtered files and append to the list
    if (filteredFiles.length > 0) {
    const html = filteredFiles.map(file => createFileRow(file, currentDir, csrf, key, isEnc)).join('');
    fileList.innerHTML += html;
        
        // Add event listeners for checkboxes
        addCheckboxEventListeners();
    }
}

// Function to add event listeners to checkboxes
function addCheckboxEventListeners() {
     const checkboxes = document.querySelectorAll('.file-checkbox');
     
    // Ensure fileManagerState exists
    if (!window.fileManagerState) {
        window.fileManagerState = { selectedFiles: [] };
    }
    
    // Ensure selectedFiles array exists
    if (!window.fileManagerState.selectedFiles) {
        window.fileManagerState.selectedFiles = [];
    }
    
     
    checkboxes.forEach(checkbox => {
        // Remove any existing event listeners
        checkbox.removeEventListener('change', checkboxChangeHandler);
        
        // Add the change event listener with a named function for easier removal
        checkbox.addEventListener('change', checkboxChangeHandler);
        
        // Apply initial state if this file should be checked according to fileManagerState
        const fullPath = checkbox.dataset.fullPath || checkbox.dataset.file;
        if (window.fileManagerState.selectedFiles.includes(fullPath)) {
            console.log(`Setting checkbox for ${fullPath} to checked based on fileManagerState`);
            checkbox.checked = true;
            const row = checkbox.closest('tr');
            if (row) {
                row.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
            }
        } else {
            // If the file is not in selectedFiles, ensure the checkbox is unchecked
            checkbox.checked = false;
            const row = checkbox.closest('tr');
            if (row) {
                row.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
            }
        }
    });
    
    // Update the select all checkbox state
    updateSelectAllCheckbox();
}

// Function to update the state of the Select All checkbox based on current selections
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAll');
    if (!selectAllCheckbox) return;
    
    const fileCheckboxes = document.querySelectorAll('.file-checkbox');
    if (fileCheckboxes.length === 0) return;
    
    const allChecked = Array.from(fileCheckboxes).every(checkbox => checkbox.checked);
    const anyChecked = Array.from(fileCheckboxes).some(checkbox => checkbox.checked);
    
    selectAllCheckbox.checked = allChecked;
    selectAllCheckbox.indeterminate = !allChecked && anyChecked;
   
}

// Separate change handler function for checkboxes
function checkboxChangeHandler() {
    const row = this.closest('tr');
    const fileName = this.dataset.file;
    const fullPath = this.dataset.fullPath || fileName;
    
    console.log('Checkbox changed:', fileName);
    console.log('Checkbox state:', this.checked ? 'checked' : 'unchecked');
    console.log('Full path:', fullPath);
    
    // Print all selected files before update
    console.log('Selected files before update:', 
                window.fileManagerState?.selectedFiles ? 
                [...window.fileManagerState.selectedFiles] : []);
    
    if (this.checked) {
        row.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
        updateSelectedFiles(fullPath, true, true);
    } else {
        row.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
        updateSelectedFiles(fullPath, false, true);
    }
    
    // Print all selected files after update
    console.log('Selected files after update:', 
                window.fileManagerState?.selectedFiles ? 
                [...window.fileManagerState.selectedFiles] : []);
    
    // Check if other checkboxes are also checked
    const checkedBoxes = document.querySelectorAll('.file-checkbox:checked');
    console.log('Total checked checkboxes:', checkedBoxes.length);
    
    // Update the select all checkbox state
    updateSelectAllCheckbox();
}

function sortFiles() {
    // Ensure fileManagerState is initialized
    if (!window.fileManagerState) {
        window.fileManagerState = {
            files: [],
            totalPages: 1,
            currentPage: 1,
            currentSort: { column: 'name', direction: 'asc' },
            selectedFiles: []
        };
        return; // Can't sort if there are no files
    }

    const { column, direction } = window.fileManagerState.currentSort;

    window.fileManagerState.files.sort((a, b) => {
        let valueA, valueB;

        // Handle different columns
        switch (column) {
            case 'name':
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
                break;
            case 'size':
                valueA = a.size === 'dir' ? -1 : parseFloat(a.size);
                valueB = b.size === 'dir' ? -1 : parseFloat(b.size);
                break;
            case 'mtime':
            case 'modified': // Add support for 'modified' column name from HTML
                valueA = new Date(a.mtime).getTime();
                valueB = new Date(b.mtime).getTime();
                break;
            case 'owner':
                valueA = a.owner.toLowerCase();
                valueB = b.owner.toLowerCase();
                break;
            case 'perms':
                valueA = a.perms;
                valueB = b.perms;
                break;
            default:
                valueA = a.name.toLowerCase();
                valueB = b.name.toLowerCase();
        }

        // Handle sorting direction
        if (direction === 'asc') {
            return valueA > valueB ? 1 : -1;
        } else {
            return valueA < valueB ? 1 : -1;
        }
    });
}

// Make sortFiles available globally
window.sortFiles = sortFiles;

function updateSelectedFiles(fileName, isChecked, isFullPath = false) {
    console.log(`updateSelectedFiles called: ${fileName}, checked: ${isChecked}, isFullPath: ${isFullPath}`);
    
    // Ensure fileManagerState is initialized
    if (!window.fileManagerState) {
        console.log('Initializing fileManagerState');
        window.fileManagerState = {
            selectedFiles: []
        };
    }
    
    // Ensure selectedFiles array exists
    if (!window.fileManagerState.selectedFiles) {
        console.log('Initializing selectedFiles array');
        window.fileManagerState.selectedFiles = [];
    }
    
    // If not a full path, try to find the checkbox to get the full path
    let fullPath = fileName;
    if (!isFullPath) {
        const checkbox = document.querySelector(`.file-checkbox[data-file="${fileName}"]`);
        console.log('Checkbox found:', checkbox ? 'yes' : 'no');
        
        // If we found the checkbox and it has a full path attribute, use that
        if (checkbox && checkbox.dataset.fullPath) {
            fullPath = checkbox.dataset.fullPath;
            console.log(`Using fullPath from checkbox: ${fullPath}`);
        }
        // Otherwise, use the current directory to construct the path
        else if (!fileName.includes('/')) {
            const currentDir = window.fileManagerState.currentDir || '';
            if (currentDir) {
                fullPath = `${currentDir}/${fileName}`;
                console.log(`Constructed fullPath: ${fullPath}`);
            }
        }
    } else {
        console.log(`Using provided fullPath: ${fullPath}`);
    }
    
    if (isChecked) {
        // Only add if not already in the array
        if (!window.fileManagerState.selectedFiles.includes(fullPath)) {
            console.log(`Adding to selectedFiles: ${fullPath}`);
            window.fileManagerState.selectedFiles.push(fullPath);
        } else {
            console.log(`File already in selectedFiles: ${fullPath}`);
        }
    } else {
        console.log(`Removing from selectedFiles: ${fullPath}`);
        window.fileManagerState.selectedFiles = window.fileManagerState.selectedFiles.filter(file => file !== fullPath);
    }
    
    console.log('Selected Files after update:', window.fileManagerState.selectedFiles);
    console.log('Selected Files count:', window.fileManagerState.selectedFiles.length);
}

// Function to reset bulk actions dropdown
function resBulk() {
    // Reset to the default option
    let bulkActionsDropdown = document.getElementById('bulkActions');
    if (bulkActionsDropdown) {
    bulkActionsDropdown.value = '';
}
}

// Clear clipboard function
function freeclipbroad() {
    try {
        localStorage.removeItem('copiedFiles');
        console.log('Clipboard cleared');
    } catch (error) {
        console.error('Failed to clear clipboard:', error);
    }
}
function handleCreate(data, type, key, isEnc, currentDir, csrf) {
    if (!['file', 'folder'].includes(type)) {
        triggerAlert("warning", "Invalid type. Only file or folder are allowed");
        return;
    }

 
    sendRequest(data, key, isEnc)

        .then(() => {
            loadDirectory(currentDir, 1, csrf, key, isEnc); // Reload directory
        })
        .catch(error => {
            triggerAlert('warning', error); // Show error message
        });


}


function viewEditFile(filePath, csrf, key, isEnc) {
    // Show progress indicator once at the start
    progr();

    try {
        // Normalise extension
        const fileName      = filePath.split('/').pop();
        const fileExtension = (fileName.split('.').pop() || '').toLowerCase();

        // Preview-able file type groups
        const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
        const videoTypes = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
        const audioTypes = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
        const pdfTypes   = ['pdf'];
        const officeDocTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

        // If the file can be previewed directly in a modal, do so and return early.
        if ([...imageTypes, ...videoTypes, ...audioTypes, ...pdfTypes, ...officeDocTypes].includes(fileExtension)) {
            showFilePreviewModal(filePath, fileName, fileExtension, csrf, key, isEnc);
            dprogr();
            return;
        }

        // For any other extension we treat the file as text/code and open it in a new tab editor.
        if (typeof window.addNewTab !== 'function') {
            console.warn('addNewTab function not found, cannot open file in an editor tab');
            triggerAlert('warning', 'Editor tab functionality is not available.');
            dprogr();
            return;
        }

        // Create an editor tab (type = 'editor')
            const newTabId = window.addNewTab(fileName, 'editor');
        let   tabContent = document.getElementById(`${newTabId}-content`);
            if (!tabContent) {
                const tabsContent = document.getElementById('tabs-content');
                if (!tabsContent) {
                dprogr();
                triggerAlert('warning', 'Tabs container not found.');
                return;
                }
                tabContent = document.createElement('div');
                tabContent.id = `${newTabId}-content`;
                tabContent.className = 'tabs-panel w-full';
                tabsContent.appendChild(tabContent);
            }
            
        // Preserve file path for save-later operations
            tabContent.dataset.filePath = filePath;
            
        // Prepare the editor container
        tabContent.innerHTML = '';
            const editorContainer = document.createElement('div');
            editorContainer.className = 'editor-container';
        editorContainer.style.width  = '100%';
            editorContainer.style.height = '90vh';
            editorContainer.style.border = '1px solid #ddd';
            editorContainer.style.position = 'relative';
            tabContent.appendChild(editorContainer);
            
        // Ensure the tab is active
            if (typeof window.switchToTab === 'function') {
                window.switchToTab(newTabId);
            }
        document.querySelectorAll('.tabs-panel').forEach(p => p.classList.add('hidden'));
            tabContent.classList.remove('hidden');
            
            // Fetch file content from the server
            sendRequest({ csrf,Connection: 'keep-alive, X-F5-Auth-Token X-F5-Auth-Token: a ' ,action: 'view_content', file: filePath }, key, isEnc)
                .then(response => {
                let content = '';
                if (typeof response === 'string') {
                    content = response;
                } else if (response && (response.content !== undefined || response.data !== undefined)) {
                    content = response.content ?? response.data;
                }

                if (typeof window.CodeMirror === 'undefined') {
                    editorContainer.innerHTML = `<pre style="white-space: pre-wrap; padding: 1rem;">${content}</pre>`;
                    triggerAlert('warning', 'CodeMirror editor not found. Displaying content in plain text mode.');
                    dprogr();
                    return;
                }

                const language = getLanguageFromFileName(filePath);
                        const editor = CodeMirror(editorContainer, {
                    value: content,
                            mode: language,
                            theme: document.documentElement.classList.contains('dark') ? 'dracula' : 'eclipse',
                            lineNumbers: true,
                            lineWrapping: true,
                            matchBrackets: true,
                            autoCloseBrackets: true,
                            styleActiveLine: true
                        });
                        window.editor = editor;
                        editor.setSize('100%', '100%');
                        
                // Add/ensure a save button
                        let saveBtn = tabContent.querySelector('.save-file-btn');
                        if (!saveBtn) {
                            saveBtn = document.createElement('button');
                            saveBtn.className = 'save-file-btn fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded shadow-lg z-50';
                            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Save';
                            saveBtn.addEventListener('click', () => {
                        const updatedContent = editor.getValue();
                        saveFileContent(filePath, updatedContent, csrf, key, isEnc);
                            });
                            tabContent.appendChild(saveBtn);
                        }
                        
                        setTimeout(() => {
                                editor.refresh();
                                editor.focus();
                        }, 100);
                    dprogr();
                })
                .catch(error => {
                console.error('Error loading file content:', error);
                
                // Try to extract detailed error message if available
                let errorMessage = 'Failed to load file content';
                
                if (error && typeof error === 'object') {
                    if (error.error) {
                        errorMessage = `Failed to load file content: ${error.error}`;
                    } else if (error.message) {
                        errorMessage = `Failed to load file content: ${error.message}`;
                    } else if (error.status) {
                        errorMessage = `Failed to load file content: Error - ${error.status}`;
                    }
                } else if (typeof error === 'string') {
                    try {
                        const parsedError = JSON.parse(error);
                        if (parsedError.error) {
                            errorMessage = `Failed to load file content: ${parsedError.error}`;
                        }
                    } catch (e) {
                        errorMessage = `Failed to load file content: ${error}`;
                    }
                }
                
                triggerAlert('warning', errorMessage);
                editorContainer.innerHTML = `
                    <div class="p-4 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md m-4">
                        <h3 class="font-bold mb-2">Error Loading File</h3>
                        <p class="mb-2">${errorMessage}</p>
                        <div class="text-sm mt-4">
                            <p><strong>Possible Solutions:</strong></p>
                            <ul class="list-disc pl-5 mt-2">
                                <li>Check file permissions (should be at least 644 or rw-r--r--)</li>
                                <li>Ensure the web server user has read access to the file</li>
                                <li>Try running: <code>chmod 644 "${filePath}"</code> on the server</li>
                            </ul>
                        </div>
                    </div>
                `;
                dprogr();
            });
    } catch (e) {
        console.error('Unexpected error in viewEditFile:', e);
        triggerAlert('warning', 'An unexpected error occurred while opening the file.');
            dprogr();
        }
}

function showFilePreviewModal(filePath, fileName, fileExtension, csrf, key, isEnc) {
    // Remove existing modal if any
    const existingModal = document.getElementById('file-preview-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal container
    const modal = document.createElement('div');
    modal.id = 'file-preview-modal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.style.zIndex = '9999';
    
    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl max-h-[90vh] w-full m-4 flex flex-col';
    
    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'flex items-center justify-between p-4 border-b dark:border-gray-700';
    modalHeader.innerHTML = `
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white truncate">${fileName}</h3>
        <div class="flex items-center space-x-2">
            <a href="#" onclick="dwn('${filePath}', '${csrf}', '${key}', '${isEnc}'); return false;" class="text-blue-500 hover:text-blue-600 dark:text-blue-400" title="Download">
                <i class="fas fa-download"></i>
            </a>
            
            <button id="close-preview-modal" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
    `;
    
    // Create modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'flex-1 p-4 overflow-auto flex items-center justify-center';
    modalBody.innerHTML = '<div class="flex items-center justify-center"><i class="fas fa-spinner fa-spin text-2xl text-gray-500"></i><span class="ml-2 text-gray-500">Loading...</span></div>';
    
    // Assemble modal
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    // Add event listeners
    document.getElementById('close-preview-modal').addEventListener('click', () => {
        modal.remove();
    });
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    // Close modal with Escape key
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);

    // Fetch file content from server
    sendRequest({ csrf, action: 'view_content', file: filePath }, key, isEnc)
        .then(response => {
            let content;
            let mimeType;
            
            if (response.is_binary) {
                content = atob(response.content); // Decode base64
                mimeType = response.mime_type;
            } else {
                content = response.content;
                mimeType = response.mime_type;
            }

            const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
            const videoTypes = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
            const audioTypes = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
            const officeTypes = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

            // Convert base64 to binary array
            if (response.is_binary) {
                const binaryLen = content.length;
                const bytes = new Uint8Array(binaryLen);
                for (let i = 0; i < binaryLen; i++) {
                    bytes[i] = content.charCodeAt(i);
                }
                content = bytes;
            }

            if (imageTypes.includes(fileExtension)) {
                // For images, create blob URL
                const blob = new Blob([content], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);
                
                const img = document.createElement('img');
                img.className = 'max-w-full max-h-full object-contain';
                img.style.maxHeight = '70vh';
                img.src = blobUrl;
                img.alt = fileName;
                
                modalBody.innerHTML = '';
                modalBody.appendChild(img);
                
                // Clean up blob URL when image loads or errors
                img.onload = () => URL.revokeObjectURL(blobUrl);
                img.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    modalBody.innerHTML = `
                        <div class="text-center text-red-500">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>Failed to load image</p>
                            <p class="text-sm text-gray-500 mt-2">${fileName}</p>
                        </div>
                    `;
                };
            } else if (videoTypes.includes(fileExtension)) {
                // For videos, create blob URL
                const blob = new Blob([content], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);
                
                const video = document.createElement('video');
                video.className = 'max-w-full max-h-full';
                video.style.maxHeight = '70vh';
                video.controls = true;
                video.preload = 'metadata';
                video.src = blobUrl;
                
                modalBody.innerHTML = '';
                modalBody.appendChild(video);
                
                // Clean up blob URL when video is removed
                video.onloadedmetadata = () => URL.revokeObjectURL(blobUrl);
                video.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    modalBody.innerHTML = `
                        <div class="text-center text-red-500">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>Failed to load video</p>
                            <p class="text-sm text-gray-500 mt-2">${fileName}</p>
                        </div>
                    `;
                };
            } else if (audioTypes.includes(fileExtension)) {
                // For audio, create blob URL
                const blob = new Blob([content], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);
                
                const audioContainer = document.createElement('div');
                audioContainer.className = 'flex flex-col items-center space-y-4 p-8';
                
                const audio = document.createElement('audio');
                audio.className = 'w-full max-w-md';
                audio.controls = true;
                audio.preload = 'metadata';
                audio.src = blobUrl;
                
                audioContainer.innerHTML = `
                    <i class="fas fa-music text-6xl text-gray-400 mb-4"></i>
                    <p class="text-gray-600 dark:text-gray-400 text-center">${fileName}</p>
                `;
                audioContainer.appendChild(audio);
                
                modalBody.innerHTML = '';
                modalBody.appendChild(audioContainer);
                
                // Clean up blob URL when audio is removed
                audio.onloadedmetadata = () => URL.revokeObjectURL(blobUrl);
                audio.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    modalBody.innerHTML = `
                        <div class="text-center text-red-500">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>Failed to load audio</p>
                            <p class="text-sm text-gray-500 mt-2">${fileName}</p>
                        </div>
                    `;
                };
            } else if (fileExtension === 'pdf') {
                // For PDFs, create blob URL
                const blob = new Blob([content], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);
                
                const iframe = document.createElement('iframe');
                iframe.src = blobUrl;
                iframe.className = 'w-full border-0 rounded';
                iframe.style.height = '70vh';
                
                modalBody.innerHTML = '';
                modalBody.appendChild(iframe);
                
                // Clean up blob URL when iframe loads or errors
                iframe.onload = () => URL.revokeObjectURL(blobUrl);
                iframe.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    modalBody.innerHTML = `
                        <div class="text-center text-red-500">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>Failed to load PDF</p>
                            <p class="text-sm text-gray-500 mt-2">
                                <a href="#" onclick="dwn('${filePath}', '${csrf}', '${key}', '${isEnc}'); return false;" class="text-blue-500 underline hover:text-blue-600">
                                    Download to view
                                </a>
                            </p>
                        </div>
                    `;
                };
            } else if (officeTypes.includes(fileExtension)) {
                // For Office docs, use Microsoft's viewer
                const blob = new Blob([content], { type: mimeType });
                const blobUrl = URL.createObjectURL(blob);
                const encodedUrl = encodeURIComponent(window.location.origin + blobUrl);
                const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodedUrl}`;
                
                const iframe = document.createElement('iframe');
                iframe.src = officeViewerUrl;
                iframe.className = 'w-full border-0 rounded';
                iframe.style.height = '70vh';
                
                modalBody.innerHTML = '';
                modalBody.appendChild(iframe);
                
                // Clean up blob URL when iframe loads or errors
                iframe.onload = () => URL.revokeObjectURL(blobUrl);
                iframe.onerror = () => {
                    URL.revokeObjectURL(blobUrl);
                    modalBody.innerHTML = `
                        <div class="text-center text-red-500">
                            <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                            <p>Failed to preview document</p>
                            <p class="text-sm text-gray-500 mt-2">
                                <a href="#" onclick="dwn('${filePath}', '${csrf}', '${key}', '${isEnc}'); return false;" class="text-blue-500 underline hover:text-blue-600">
                                    Download to view
                                </a>
                            </p>
                        </div>
                    `;
                };
            }
        })
        .catch(error => {
            console.error('Error loading file:', error);
            modalBody.innerHTML = `
                <div class="text-center text-red-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p>Failed to load file</p>
                    <p class="text-sm text-gray-500 mt-2">${error.message || 'Unknown error'}</p>
                </div>
            `;
        });
}

// Helper function to get the proper file URL
function getFileUrl(filePath) {
    // If the filePath is already a complete URL, use it as is
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('/')) {
        return filePath;
    }
    
    // Otherwise, construct the URL based on your server setup
    // Adjust this based on how your server serves static files
    return `/${filePath}`;
}

// Helper function for PDF.js (optional, implement if you have PDF.js)
function loadPDFWithPDFJS(filePath, container) {
    // This is a placeholder for PDF.js implementation
    // You would need to implement this based on your PDF.js setup
    console.log('PDF.js loading not implemented, falling back to iframe');
    
    const iframe = document.createElement('iframe');
    iframe.src = `${filePath}?t=${Date.now()}`;
    iframe.className = 'w-full h-full border-0';
    iframe.style.minHeight = '60vh';
    
    container.innerHTML = '';
    container.appendChild(iframe);
}
 
function saveFileContent(filePath, content, csrf, key, isEnc) {
    progr();
    const data = {
        csrf: csrf,
        action: 'save_content',
        file: filePath,
        content: content
    };

    sendRequest(data, key, isEnc)
        .then(() => {
            triggerAlert('success', 'File content saved successfully!');
        })
        .catch(error => {
            triggerAlert('warning', error);
            dprogr
        });
        dprogr();
}

/**
 * Context Menu for File Manager
 * This module provides a right-click context menu for file and folder operations
 */

// Store the current context menu target for callback operations
let contextMenuTarget = null;
let currentContextMenuType = null; // 'file', 'folder', 'multiple', or 'background'

/**
 * Initialize the context menu functionality
 * @param {Object} options Configuration options and callbacks
 */
function initContextMenu(options = {}) {
    // Create the context menu element if it doesn't exist
    if (!document.getElementById('context-menu')) {
        createContextMenuElement();
    }

    const contextMenu = document.getElementById('context-menu');
    
    // Add the context menu event listeners
    // Only apply context menu to the file manager area
    document.getElementById('file').addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('click', hideContextMenu);
    window.addEventListener('blur', hideContextMenu);
    window.addEventListener('resize', hideContextMenu);
    
    // Listen for scroll events on any scrollable container
    document.addEventListener('scroll', hideContextMenu, true);
    // Also specifically target the file manager container
    const fileContainer = document.getElementById('file');
    if (fileContainer) {
        fileContainer.addEventListener('scroll', hideContextMenu, true);
    }

    // Add click handlers for all menu items
    addMenuItemEventListeners();
    
 }

/**
 * Create the context menu DOM element
 */
function createContextMenuElement() {
    const contextMenu = document.createElement('div');
    contextMenu.id = 'context-menu';
    contextMenu.className = 'hidden fixed z-50 min-w-[200px] bg-white dark:bg-gray-800 shadow-lg rounded-md py-2 border border-gray-200 dark:border-gray-700';
    
    // Set the HTML content for the context menu
    contextMenu.innerHTML = `
        <div class="context-menu-group file-operations hidden">
            <button class="context-menu-item" data-action="rename">
                <i class="fas fa-signature mr-2"></i>Rename
            </button>
            <button class="context-menu-item" data-action="download">
                <i class="fas fa-download mr-2"></i>Download
            </button>
        </div>
        <div class="context-menu-group folder-operations hidden">
            <button class="context-menu-item" data-action="open-folder">
                <i class="fas fa-folder-open mr-2"></i>Open
            </button>
            <button class="context-menu-item" data-action="open-folder-new-tab">
                <i class="fas fa-external-link-alt mr-2"></i>Open in New Tab
            </button>
            <button class="context-menu-item" data-action="rename-folder">
                <i class="fas fa-signature mr-2"></i>Rename
            </button>
        </div>
        <div class="context-menu-group clipboard-operations">
            <button class="context-menu-item" data-action="copy">
                <i class="fas fa-copy mr-2"></i>Copy
            </button>
            <button class="context-menu-item" data-action="cut">
                <i class="fas fa-cut mr-2"></i>Cut
            </button>
            <button class="context-menu-item paste-option hidden" data-action="paste">
                <i class="fas fa-paste mr-2"></i>Paste
            </button>
        </div>
        <div class="context-menu-divider border-t border-gray-200 dark:border-gray-700 my-1"></div>
        <div class="context-menu-group danger-operations">
            <button class="context-menu-item text-red-600 dark:text-red-400" data-action="delete">
                <i class="fas fa-trash-alt mr-2"></i>Delete
            </button>
        </div>
        <div class="context-menu-group bg-operations hidden">
            <div class="context-menu-divider border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button class="context-menu-item" data-action="new-file">
                <i class="fas fa-file-circle-plus mr-2"></i>New File
            </button>
            <button class="context-menu-item" data-action="new-folder">
                <i class="fas fa-folder-plus mr-2"></i>New Folder
            </button>
            <button class="context-menu-item" data-action="refresh">
                <i class="fas fa-sync-alt mr-2"></i>Refresh
            </button>
        </div>
    `;
    
    // Add styles for context menu items
    const style = document.createElement('style');
    style.textContent = `
        .context-menu-item {
            display: flex;
            align-items: center;
            width: 100%;
            text-align: left;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            white-space: nowrap;
            color: #374151; /* gray-700 */
            transition: background-color 0.15s ease;
        }
        .dark .context-menu-item {
            color: #e5e7eb; /* gray-200 */
        }
        .context-menu-item:hover {
            background-color: rgba(59, 130, 246, 0.1);
        }
        .dark .context-menu-item:hover {
            background-color: rgba(96, 165, 250, 0.1);
        }
        .context-menu-item:focus {
            outline: none;
            background-color: rgba(59, 130, 246, 0.15);
        }
        .dark .context-menu-item:focus {
            background-color: rgba(96, 165, 250, 0.15);
        }
        .context-menu-item i {
            color: #4b5563; /* gray-600 */
        }
        .dark .context-menu-item i {
            color: #d1d5db; /* gray-300 */
        }
        .context-menu-item.text-red-600 i {
            color: #dc2626; /* red-600 */
        }
        .dark .context-menu-item.text-red-400 i {
            color: #f87171; /* red-400 */
        }
        @keyframes contextMenuFadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
        #context-menu {
            transform-origin: top left;
            animation: contextMenuFadeIn 0.1s ease-out forwards;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .dark #context-menu {
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.18);
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(contextMenu);
}

/**
 * Handle right-click events to show the context menu
 * @param {Event} e - The contextmenu event
 */
function handleContextMenu(e) {
    // Prevent the default context menu
    e.preventDefault();
    
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;
    
    // Reset any existing context menu state
    contextMenu.classList.add('hidden');
    
    // Hide all context menu groups by default
    hideAllMenuGroups();
    
    // Update contextMenuTarget and determine the type of element right-clicked
    setContextMenuTarget(e);
    
    // Show only the relevant menu groups based on the context
    updateMenuVisibility();
    
    // Check if clipboard has items for paste option
    updatePasteOption();
    
    // Position the menu at the cursor - use clientX and clientY since we're using fixed positioning
    positionContextMenu(e.clientX, e.clientY);
    
    // Show the menu with a fade-in effect after a small delay to ensure proper rendering
    setTimeout(() => {
        contextMenu.classList.remove('hidden');
    }, 10);
}

/**
 * Set the context menu target and determine its type
 * @param {Event} e - The contextmenu event
 */
function setContextMenuTarget(e) {
    // Check if we right-clicked on a file/folder item or checkbox
    let target = e.target;
    
    // Handle right-clicks on various elements within a file/folder row
    if (target.closest('tr')) {
        const row = target.closest('tr');
        // Get the file/folder element in this row
        const checkbox = row.querySelector('.file-checkbox');
        
        // If we have a checkbox with data-file attribute
        if (checkbox && checkbox.dataset.file) {
            contextMenuTarget = checkbox.dataset.file;
            
            // Check if this is a directory or file
            const isDir = row.querySelector('.directory-link') !== null;
            currentContextMenuType = isDir ? 'folder' : 'file';
            
            // If there are multiple files selected, change the type to 'multiple'
            if (document.querySelectorAll('.file-checkbox:checked').length > 1 && checkbox.checked) {
                currentContextMenuType = 'multiple';
            }
            
            return;
        }
    }
    
    // Default to background click (empty space in the file area)
    contextMenuTarget = document.getElementById('fileList');
    currentContextMenuType = 'background';
}

/**
 * Show only the menu groups relevant to the current context
 */
function updateMenuVisibility() {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;
    
    // Hide all groups first
    hideAllMenuGroups();
    
    // Show relevant groups based on context
    if (currentContextMenuType === 'file') {
        contextMenu.querySelector('.file-operations').classList.remove('hidden');
        contextMenu.querySelector('.clipboard-operations').classList.remove('hidden');
    } 
    else if (currentContextMenuType === 'folder') {
        contextMenu.querySelector('.folder-operations').classList.remove('hidden');
        contextMenu.querySelector('.clipboard-operations').classList.remove('hidden');
    }
    else if (currentContextMenuType === 'multiple') {
        contextMenu.querySelector('.clipboard-operations').classList.remove('hidden');
    }
    else if (currentContextMenuType === 'background') {
        contextMenu.querySelector('.bg-operations').classList.remove('hidden');
        contextMenu.querySelector('.paste-option').classList.remove('hidden');
    }
}

/**
 * Hide all menu groups
 */
function hideAllMenuGroups() {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;
    
    const groups = contextMenu.querySelectorAll('.context-menu-group');
    groups.forEach(group => group.classList.add('hidden'));
}

/**
 * Check if clipboard has items and update paste option visibility
 */
function updatePasteOption() {
    const pasteOption = document.querySelector('.paste-option');
    if (!pasteOption) return;
    
    // Check if there are items in clipboard (localStorage)
    const hasClipboardItems = localStorage.getItem('copiedFiles') !== null;
    
    if (hasClipboardItems) {
        pasteOption.classList.remove('hidden');
    } else {
        pasteOption.classList.add('hidden');
    }
}

/**
 * Position the context menu at the cursor
 * @param {number} x - The x coordinate
 * @param {number} y - The y coordinate
 */
function positionContextMenu(x, y) {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;
    
    // Get viewport dimensions
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Get scroll position
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // Get menu dimensions
    contextMenu.style.visibility = 'hidden';
    contextMenu.classList.remove('hidden');
    const menuWidth = contextMenu.offsetWidth;
    const menuHeight = contextMenu.offsetHeight;
    
    // Calculate position to ensure menu stays within viewport
    let menuX = x;
    let menuY = y;
    
    // Adjust if menu would go off right edge
    if (x + menuWidth > viewportWidth) {
        menuX = viewportWidth - menuWidth - 5;
    }
    
    // Adjust if menu would go off bottom edge
    if (y + menuHeight > viewportHeight) {
        menuY = viewportHeight - menuHeight - 5;
    }
    
    // Position the menu - account for scroll position
    contextMenu.style.left = `${menuX}px`;
    contextMenu.style.top = `${menuY}px`;
    contextMenu.style.position = 'fixed'; // Use fixed positioning to work with scroll
    contextMenu.style.visibility = 'visible';
}

/**
 * Hide the context menu
 */
function hideContextMenu() {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
        contextMenu.classList.add('hidden');
    }
    contextMenuTarget = null;
}

/**
 * Add event listeners to menu items
 */
function addMenuItemEventListeners() {
    const contextMenu = document.getElementById('context-menu');
    if (!contextMenu) return;
    
    const menuItems = contextMenu.querySelectorAll('.context-menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = item.dataset.action;
            handleMenuAction(action);
            hideContextMenu();
        });
    });
}

/**
 * Handle menu item actions
 * @param {string} action - The action to perform
 */
function handleMenuAction(action) {
    // Get current directory, CSRF token, and encryption key from global state
    const currentDir = window.fileManagerState?.currentDir || phpVars?.currentDir;
    const csrf = phpVars?.csrf;
    const key = phpVars?.encryptionKey ? CryptoJS.enc.Utf8.parse(phpVars.encryptionKey) : null;
    const isEnc = phpVars?.isEnc;
    
    // Utility function to join paths without double slashes
    const joinPaths = (base, path) => {
        if (base.endsWith('/')) {
            return base + path;
        } else {
            return base + '/' + path;
        }
    };
    
    // Handle actions based on type
    switch (action) {
        case 'open-folder':
            if (contextMenuTarget) {
                // Navigate to the folder
                const newDir = joinPaths(currentDir, contextMenuTarget);
                window.currentDir = newDir;
                // Use the global function from main.js
                window.updateCurrentPath();
                
                // Get current items per page setting
                let itemLimitElement = document.getElementById('itemLimit');
                let itemsPerPage = itemLimitElement ? itemLimitElement.value : '50';
                
                loadDirectory(newDir, 1, csrf, key, isEnc, itemsPerPage);
                // Use the global function from main.js
                window.updateActiveTabPath(newDir);
            }
            break;
            
        case 'open-folder-new-tab':
            if (contextMenuTarget) {
                // Navigate to folder in new tab
                const newDir = joinPaths(currentDir, contextMenuTarget);
                // Call the addNewTab function from main.js and then load the directory
                if (typeof window.addNewTab === 'function') {
                    const newTabId = window.addNewTab(contextMenuTarget);
                    // Load the directory in the new tab
                    loadDirectory(newDir, 1, csrf, key, isEnc);
                    // Set the path for the new tab
                    window.updateActiveTabPath(newDir);
                } else {
                    // Fallback if addNewTab function is not available
                    console.warn('addNewTab function not found, using current tab');
                    window.currentDir = newDir;
                    window.updateCurrentPath();
                    loadDirectory(newDir, 1, csrf, key, isEnc);
                    window.updateActiveTabPath(newDir);
                }
            }
            break;
            
        case 'rename':
        case 'rename-folder':
            if (contextMenuTarget) {
                renameFile(contextMenuTarget, csrf, currentDir, key, isEnc);
            }
            break;
            
        case 'download':
            if (contextMenuTarget) {
                dwn(joinPaths(currentDir, contextMenuTarget), csrf, key, isEnc);
            }
            break;
            
        case 'copy':
            if (currentContextMenuType === 'multiple') {
                // Get all selected files with full paths
                const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
                    .map(checkbox => {
                        const fileName = checkbox.dataset.file;
                        return joinPaths(currentDir, fileName);
                    });
                saveToLocalStorage(selectedFiles);
            } else if (contextMenuTarget) {
                saveToLocalStorage([joinPaths(currentDir, contextMenuTarget)]);
            }
            triggerAlert('success', 'Item(s) copied to clipboard');
            break;
            
        case 'cut':
            // Similar to copy, but mark for moving instead of copying
            if (currentContextMenuType === 'multiple') {
                const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
                    .map(checkbox => {
                        const fileName = checkbox.dataset.file;
                        return joinPaths(currentDir, fileName);
                    });
                saveToLocalStorage(selectedFiles);
                // Store that this is a cut operation
                localStorage.setItem('clipboard-action', 'cut');
            } else if (contextMenuTarget) {
                saveToLocalStorage([joinPaths(currentDir, contextMenuTarget)]);
                localStorage.setItem('clipboard-action', 'cut');
            }
            triggerAlert('info', 'Item(s) ready to move');
            break;
            
        case 'paste':
            // Get files from clipboard
            const files = getFromLocalStorage();
            if (files && files.length > 0) {
                console.log('Attempting to paste files:', files);
                console.log('Current directory:', currentDir);
                
                // Show a loading indicator
                triggerAlert('info', `Pasting ${files.length} item(s)...`);
                
                performBulkAction('paste', files, currentDir, csrf, key, isEnc);
                
                // Clear clipboard after paste
                freeclipbroad();
                localStorage.removeItem('clipboard-action');
            } else {
                triggerAlert('warning', 'No items in clipboard');
            }
            break;
            
        case 'delete':
            if (currentContextMenuType === 'multiple') {
                // Delete all selected files
                const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
                    .map(checkbox => checkbox.dataset.file);
                    
                showConfirmation(
                    'Delete Files',
                    `Are you sure you want to delete ${selectedFiles.length} file(s)?`,
                    'Delete',
                    () => {
                        performBulkAction('delete', selectedFiles, currentDir, csrf, key, isEnc);
                    }
                );
            } else if (contextMenuTarget) {
                deleteFile(contextMenuTarget, csrf, currentDir, key, isEnc);
            }
            break;
            
       
        case 'refresh':
            loadDirectory(currentDir, 1, csrf, key, isEnc);
            break;
    }
}

// Export the initialization function
window.initContextMenu = initContextMenu;

/**
 * Get the language for code editor based on file extension
 * @param {string} fileName - The name of the file
 * @returns {string} - The language mode for the editor
 */
function getLanguageFromFileName(fileName) {
    // Handle missing or undefined fileName
    if (!fileName) return 'plaintext';
    
    const extension = fileName.split('.').pop().toLowerCase();
    
    // Map of file extensions to CodeMirror modes
    const modeMap = {
        // Web languages
        'js': 'javascript',
        'mjs': 'javascript',
        'cjs': 'javascript',
        'jsx': 'javascript',
        'ts': 'javascript',
        'tsx': 'javascript',
        'html': 'htmlmixed',
        'htm': 'htmlmixed',
        'css': 'css',
        'scss': 'css',
        'less': 'css',
        'json': 'javascript',
        'xml': 'xml',
        'svg': 'xml',
        
        // Server languages
        'php': 'php',
        'py': 'python',
        'rb': 'ruby',
        'java': 'clike',
        'c': 'clike',
        'cpp': 'clike',
        'cs': 'clike',
        'h': 'clike',
        'hpp': 'clike',
        
        // Shell and config
        'sh': 'shell',
        'bash': 'shell',
        'zsh': 'shell',
        'fish': 'shell',
        'conf': 'shell',
        'ini': 'shell',
        'yaml': 'yaml',
        'yml': 'yaml',
        
        // Data and documentation
        'md': 'markdown',
        'markdown': 'markdown',
        'sql': 'sql',
        'txt': 'plaintext',
        'log': 'plaintext'
    };
    
    // Return the mapped mode or plaintext if not found
    return modeMap[extension] || 'plaintext';
}

/**
 * Format file permissions with colored characters
 * @param {string} permsString - The permissions string in rwx format
 * @returns {string} - HTML with colored permission characters
 */
function formatPermissions(permsString, isWritable = null, isReadable = true) {
    if (!permsString || typeof permsString !== 'string' || permsString.length !== 9) {
        return '<span class="text-blue-600 dark:text-blue-400">invalid</span>';
    }

    // Determine the overall permission color based on actual file access
    let permColor;
    if (isWritable !== null) {
        // If writability is explicitly provided
        if (isWritable) {
            // Has write permission - green
            permColor = 'text-green-600 dark:text-green-400';
        } else if (isReadable) {
            // Read-only - yellow
            permColor = 'text-yellow-600 dark:text-yellow-400';
        } else {
            // No access - blue
            permColor = 'text-blue-600 dark:text-blue-400';
        }
    } else {
        // Fall back to string-based detection if no explicit writability provided
        if (permsString.includes('w')) {
            permColor = 'text-green-600 dark:text-green-400';
        } else if (permsString.includes('r')) {
            permColor = 'text-yellow-600 dark:text-yellow-400';
        } else {
            permColor = 'text-blue-600 dark:text-blue-400';
        }
    }
    
    // Format the permission string with spaces between groups
    let formatted = '';
    for (let i = 0; i < permsString.length; i++) {
        formatted += permsString[i];
        // Add space between groups (user/group/world)
        if (i === 2 || i === 5) {
            formatted += ' ';
        }
    }
    
    // Return the entire string in a single color
    return `<span class="${permColor} font-mono">${formatted}</span>`;
}

// Make renderFiles available globally
window.renderFiles = renderFiles;

// Diagnostic function to check if all required functions are available
function diagnoseFileSorting() {
    console.log("--- File Sorting Diagnostics ---");
    console.log("window.fileManagerState exists:", window.fileManagerState ? "Yes" : "No");
    if (window.fileManagerState) {
        console.log("fileManagerState contents:", window.fileManagerState);
    }
    
    console.log("sortFiles function exists:", typeof window.sortFiles === 'function' ? "Yes" : "No");
    console.log("renderFiles function exists:", typeof window.renderFiles === 'function' ? "Yes" : "No");
    console.log("createFileRow function exists:", typeof window.createFileRow === 'function' ? "Yes" : "No");
    
    // Check if the table headers have the correct data-sort attributes
    const headers = document.querySelectorAll('th[data-sort]');
    console.log("Table headers with data-sort attributes:", headers.length);
    headers.forEach(header => {
        console.log(`Header: ${header.textContent.trim()}, data-sort: ${header.dataset.sort}`);
    });
    
    return {
        fileManagerState: window.fileManagerState ? "Available" : "Missing",
        sortFiles: typeof window.sortFiles === 'function' ? "Available" : "Missing",
        renderFiles: typeof window.renderFiles === 'function' ? "Available" : "Missing",
        createFileRow: typeof window.createFileRow === 'function' ? "Available" : "Missing",
        headers: Array.from(headers).map(h => ({ text: h.textContent.trim(), sort: h.dataset.sort }))
    };
}

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The time to wait in milliseconds
 * @returns {Function} - The debounced function
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Diagnostic function for search functionality
 * @returns {Object} - Diagnostic information about search functionality
 */
function diagnoseSearch() {
    console.log("--- Search Functionality Diagnostics ---");
    
    // Check search bar
    const searchBar = document.getElementById('searchBar') || document.querySelector('#searchBar');
    console.log("Search bar found:", searchBar ? "Yes" : "No");
    if (searchBar) {
        console.log("Search value:", searchBar.value);
    }
    
    // Check clear button
    const clearButton = document.getElementById('clearSearch');
    console.log("Clear button found:", clearButton ? "Yes" : "No");
    if (clearButton) {
        console.log("Clear button visible:", clearButton.style.display !== 'none');
    }
    
    // Check fileManagerState
    console.log("fileManagerState exists:", window.fileManagerState ? "Yes" : "No");
    if (window.fileManagerState) {
        console.log("Number of files in state:", window.fileManagerState.files ? window.fileManagerState.files.length : 0);
    }
    
    // Check search function
    console.log("searchFiles function exists:", typeof window.searchFiles === 'function' ? "Yes" : "No");
    
    // Test search if possible
    if (typeof window.searchFiles === 'function' && window.fileManagerState && window.fileManagerState.files) {
        const testQuery = "test";
        const results = window.searchFiles(window.fileManagerState.files, testQuery);
        console.log(`Test search for "${testQuery}" returned ${results.length} results`);
    }
    
    return {
        searchBarFound: searchBar ? true : false,
        searchValue: searchBar ? searchBar.value : null,
        clearButtonFound: clearButton ? true : false,
        clearButtonVisible: clearButton ? clearButton.style.display !== 'none' : false,
        fileManagerStateExists: window.fileManagerState ? true : false,
        fileCount: window.fileManagerState && window.fileManagerState.files ? window.fileManagerState.files.length : 0,
        searchFunctionExists: typeof window.searchFiles === 'function'
    };
}

/**
 * Update the file table footer with item count information
 */
function updateFileTableFooter() {
    // Get the table element
    const table = document.querySelector('.overflow-x-auto table');
    if (!table) return;
    
    // Calculate values
    const state = window.fileManagerState || {};
    const totalItems = state.totalItems || 0;
    const currentPage = state.currentPage || 1;
    const itemsPerPage = state.itemsPerPage || 50;
    const filesCount = state.files ? state.files.length : 0;
    
    // Calculate the start and end item numbers
    let startItem, endItem;
    
    if (itemsPerPage === 'all') {
        startItem = totalItems > 0 ? 1 : 0;
        endItem = totalItems;
    } else {
        startItem = totalItems === 0 ? 0 : (currentPage - 1) * parseInt(itemsPerPage, 10) + 1;
        endItem = Math.min(startItem + filesCount - 1, totalItems);
    }
    
    // Remove existing tfoot if it exists
    let tfoot = table.querySelector('tfoot');
    if (tfoot) {
        tfoot.remove();
    }
    
    // Create new tfoot element
    tfoot = document.createElement('tfoot');
    tfoot.className = 'bg-gray-50 dark:bg-gray-700 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700';
    
    // Create footer content
    tfoot.innerHTML = `
        <tr> 
            <td colspan="7" class="py-3 px-6">
                <div class="flex justify-between items-center">
                    <div>
                        <span class="font-medium">Showing:</span> 
                        <span class="text-blue-600 dark:text-blue-400 font-medium">${endItem}</span> 
                        of 
                        <span class="text-blue-600 dark:text-blue-400 font-medium">${totalItems}</span> items
                    </div>
                </div>
            </td>
        </tr>
    `;
    
    // Append the footer to the table
    table.appendChild(tfoot);
    
    // Remove old separate footer if it exists
    const oldFooter = document.getElementById('fileTableFooter');
    if (oldFooter) {
        oldFooter.remove();
    }
}

// Expose all necessary utility functions globally
function exposeGlobalFunctions() {
    // Expose functions to the global scope
    window.initializeFileManager = initializeFileManager;
    window.showDialog = showDialog;
    window.showConfirmation = showConfirmation;
    window.progr = progr;
    window.dprogr = dprogr;
    window.loadDirectory = loadDirectory;
    window.handleDirectoryResponse = handleDirectoryResponse;
    window.createFileRow = createFileRow;
    window.triggerAlert = triggerAlert;
    window.encrypt = encrypt;
    window.decrypt = decrypt;
    window.searchFiles = searchFiles;
    window.renderFiles = renderFiles;
    window.appendFiles = appendFiles;
    window.viewEditFile = viewEditFile;
    // window.dwn = dwn;
    window.saveFileContent = saveFileContent;
    window.updateSelectedFiles = updateSelectedFiles;
    window.getLanguageFromFileName = getLanguageFromFileName;
    window.formatPermissions = formatPermissions;
}

// Call this function to expose all utility functions
exposeGlobalFunctions();

// Function to automatically track and save opened files state
function saveOpenedFilesState(filePath, action = 'add') {
    try {
        // Get current open files
        let openFiles = JSON.parse(localStorage.getItem('fileManager_openFiles') || '[]');
        
        if (action === 'add') {
            // Add file if not already in the list
            if (!openFiles.includes(filePath)) {
                openFiles.push(filePath);
                console.log(`Added ${filePath} to tracked open files`);
            }
        } else if (action === 'remove') {
            // Remove file from the list
            openFiles = openFiles.filter(file => file !== filePath);
            console.log(`Removed ${filePath} from tracked open files`);
        }
        
        // Save updated list
        localStorage.setItem('fileManager_openFiles', JSON.stringify(openFiles));
        return true;
    } catch (error) {
        console.error('Error saving opened files state:', error);
        return false;
    }
}

// Expose the function globally
window.saveOpenedFilesState = saveOpenedFilesState;

// Expose preview modal globally so main.js or inline onclick can reuse it
window.showFilePreviewModal = showFilePreviewModal;
 


function dwn(filePath, csrf, key, isEnc) {
    const data = {
        csrf: csrf,
        action: 'download',
        file: filePath
    };

    const jsonData = JSON.stringify(data);
    const encryptedData = isEnc === '1' ? encrypt(jsonData, key) : jsonData;

    // Send the request to the server
    fetch('', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: encryptedData
    })
    .then(response => {
        if (response.ok) {
            return response.blob(); // Get the file as a Blob
        } else {
            throw new Error('Failed to download file');
        }
    })
    .then(blob => {
        // Create a temporary URL for the Blob
        const url = window.URL.createObjectURL(blob);

        // Create a link element and trigger the download
        const a = document.createElement('a');
        a.href = url;
        a.download = filePath.split('/').pop(); // Set the file name
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    })
    .catch(error => {
        console.error('Error downloading file:', error);
        triggerAlert('warning', 'Failed to download file. Please try again.');
    });
}
 
