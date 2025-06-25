document.addEventListener('DOMContentLoaded', function () {
    // Try to restore tabs from localStorage
    if (window.loadTabsFromLocalStorage && typeof window.loadTabsFromLocalStorage === 'function') {
        const tabsLoaded = window.loadTabsFromLocalStorage();
        
        // If tabs were loaded, try to restore open editor files
        if (tabsLoaded) {
            restoreOpenEditorFiles();
        }
    }
 
    // Initialize SQL Explorer when the SQL tab is selected
    document.getElementById('sql-tab')?.addEventListener('click', function() {
        if (typeof window.initSQLExplorer === 'function') {
            window.initSQLExplorer();
        }
    });
    
    // Initialize context menu for file/folder operations
    if (typeof window.initContextMenu === 'function') {
        window.initContextMenu();
    }
    
    // Expose utility functions to global scope for keyboard shortcuts
    exposeUtilityFunctions();
    
    // Initialize global keyboard shortcuts
    initGlobalKeyboardShortcuts();

    // Helper function to clear file selection
    window.clearFileSelection = function() {
        // Clear selected files array
        if (window.fileManagerState) {
            window.fileManagerState.selectedFiles = [];
        }
        
        // Uncheck all checkboxes
        document.querySelectorAll('.file-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        // Uncheck "Select All" checkbox if it exists
        let selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
        
        // Remove highlight from all rows
        document.querySelectorAll('#fileList tr.bg-blue-50, #fileList tr.dark\\:bg-blue-900\\/20').forEach(row => {
            row.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
        });
    };

    // Access the PHP variables from the global phpVars object
    const csrf = phpVars.csrf;
    let currentDir = phpVars.currentDir;
    const isEnc = phpVars.isEnc;
    const key = CryptoJS.enc.Utf8.parse(phpVars.encryptionKey);
    const homeDir = phpVars.currentDir;
    let updir;
    // Terminal functionality
    var path = phpVars.terPWD;
    var command = '';
    var command_history = [];
    var history_index = 0;
    var suggest = false;
    var blink_position = 0;
    var autocomplete_position = 0;
    var autocomplete_search_for = '';
    var autocomplete_temp_results = [];
    var autocomplete_current_result = '';
    let commands_list = phpVars.cmList;
    // Initialize Monaco Editor
    let editor;
    // Store theme preference globally
    window.editorThemePreference = localStorage.getItem('editor-theme');
    if (window.editorThemePreference === 'system') {
        // Use system preference
        window.editorThemePreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    }

    // console.log('CSRF Token:', csrf);
    // console.log('Current Directory:', currentDir);
    // console.log('Is Encrypted:', isEnc);

    // Initialize variables
    let currentPage = 1;
    let totalPages = 1;
    let currentSort = { column: 'name', direction: 'asc' };
    let files = []; // Define files as a global variable

    // Clipboard state
    let clipboard = { action: "", path: [] };

    // Wait for Flowbite to load since it's included with defer
    function checkFlowbiteLoaded() {
        if (typeof window.flowbite !== 'undefined') {
            console.log('Flowbite detected, initializing components');
            
            // Initialize Flowbite tabs
            if (window.flowbite.initTabs) {
                window.flowbite.initTabs();
            }
            
            // Initialize our enhanced tabs
            setTimeout(() => {
                initEnhancedTabs();
            }, 100);
        } else {
            // If Flowbite is not loaded yet, check again after a short delay
            setTimeout(checkFlowbiteLoaded, 50);
        }
    }
    
    // Start checking if Flowbite is loaded
    // checkFlowbiteLoaded();

    // Utility functions
    function showDialog(title, message, confirmButtonText, defaultValue = '', callback) {
        // Check if dark mode is enabled
        const isDarkMode = document.documentElement.classList.contains('dark');
        
        Swal.fire({
            title: title,
            html: `
                <div class="flex flex-col w-full">
                    <label for="dialog-input" class="text-left mb-2 text-gray-700 dark:text-gray-300 text-sm font-medium">${message}</label>
                    <input id="dialog-input" type="text" value="${defaultValue}" class="w-full p-3 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: confirmButtonText,
            cancelButtonText: 'Cancel',
            customClass: {
                popup: 'dark:bg-gray-800 dark:text-gray-200',
                title: 'text-gray-800 dark:text-gray-200',
                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
                cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white'
            },
            background: isDarkMode ? '#1F2937' : '#FFFFFF',
            focusConfirm: false,
            preConfirm: () => {
                const value = document.getElementById('dialog-input').value;
                if (!value || value.trim() === '') {
                    Swal.showValidationMessage('You need to enter a value!');
                    return false;
                }
                return value;
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                callback(result.value);
            }
        });
    }

    function showRenameDialog(title, message, confirmButtonText, defaultValue = '', callback) {
        // Check if dark mode is enabled
        const isDarkMode = document.documentElement.classList.contains('dark');
        
        Swal.fire({
            title: title,
            html: `
                <div class="flex flex-col w-full">
                    <label for="rename-input" class="text-left mb-2 text-gray-700 dark:text-gray-300 text-sm font-medium">${message}</label>
                    <input id="rename-input" type="text" value="${defaultValue}" class="w-full p-3 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50">
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: confirmButtonText,
            cancelButtonText: 'Cancel',
            customClass: {
                popup: 'dark:bg-gray-800 dark:text-gray-200',
                title: 'text-gray-800 dark:text-gray-200',
                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
                cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white'
            },
            background: isDarkMode ? '#1F2937' : '#FFFFFF',
            focusConfirm: false,
            preConfirm: () => {
                const value = document.getElementById('rename-input').value;
                if (!value || value.trim() === '') {
                    Swal.showValidationMessage('You need to enter a value!');
                    return false;
                }
                return value;
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                callback(result.value);
            }
        });
    }

    // Enhanced dialog for creating zip files with compression options
    function showZipCreationDialog(title, message, confirmButtonText, defaultValue = '', callback) {
        const isDarkMode = document.documentElement.classList.contains('dark');
        const darkModeClasses = isDarkMode ? 
            'bg-gray-800 text-white border-gray-700' : 
            'bg-white text-gray-900 border-gray-300';
            
        Swal.fire({
            title: title,
            html: `
                <div class="flex flex-col space-y-4">
                    <div class="w-full">
                        <label for="zipFileName" class="text-sm font-medium block mb-1">
                            ${message}
                        </label>
                        <input id="zipFileName" type="text" value="${defaultValue}" 
                               class="w-full p-2 border rounded ${darkModeClasses}">
                    </div>
                    <div class="w-full">
                        <label for="compressionLevel" class="text-sm font-medium block mb-1">
                            Compression Level:
                        </label>
                        <select id="compressionLevel" class="w-full p-2 border rounded ${darkModeClasses}">
                            <option value="0">Store only (no compression)</option>
                            <option value="1">Fastest (lowest compression)</option>
                            <option value="5" selected>Normal (balanced)</option>
                            <option value="9">Maximum (slowest)</option>
                        </select>
                    </div>
                    <div class="w-full">
                        <label for="archiveFormat" class="text-sm font-medium block mb-1">
                            Archive Format:
                        </label>
                        <select id="archiveFormat" class="w-full p-2 border rounded ${darkModeClasses}">
                            <option value="zip" selected>ZIP (.zip)</option>
                            <option value="tar">TAR (.tar)</option>
                            <option value="tar.gz">TAR GZ (.tar.gz)</option>
                            <option value="tar.bz2">TAR BZ2 (.tar.bz2)</option>
                            <option value="tar.xz">TAR XZ (.tar.xz)</option>
                            <option value="gz">GZIP (.gz)</option>
                        </select>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: confirmButtonText,
            cancelButtonText: 'Cancel',
            customClass: {
                popup: isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-900',
                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded',
                cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded mr-2'
            },
            preConfirm: () => {
                const zipFileName = document.getElementById('zipFileName').value;
                const compressionLevel = document.getElementById('compressionLevel').value;
                const archiveFormat = document.getElementById('archiveFormat').value;
                
                if (!zipFileName) {
                    Swal.showValidationMessage('Please enter a filename');
                    return false;
                }
                
                return {
                    zipFileName: zipFileName,
                    compressionLevel: compressionLevel,
                    archiveFormat: archiveFormat
                };
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                callback(result.value);
            }
        });
    }

    function showConfirmation(title, message, confirmButtonText, callback) {
        // Check if dark mode is enabled
        const isDarkMode = document.documentElement.classList.contains('dark');
        
        Swal.fire({
            title: title,
            text: message,
            icon: 'warning',
            iconColor: isDarkMode ? '#FBBF24' : '#F59E0B', // Amber color for warning icon
            showCancelButton: true,
            confirmButtonText: confirmButtonText,
            cancelButtonText: 'Cancel',
            customClass: {
                popup: 'dark:bg-gray-800 dark:text-gray-200',
                title: 'text-gray-800 dark:text-gray-200',
                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
                cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white'
            },
            background: isDarkMode ? '#1F2937' : '#FFFFFF'
        }).then((result) => {
            if (result.isConfirmed) {
                callback();
            }
        });
    }

    // Initialize items per page from localStorage
    const defaultItemsPerPage = localStorage.getItem('default-items-per-page');
    if (defaultItemsPerPage) {
        const itemLimitElement = document.getElementById('itemLimit');
        if (itemLimitElement) {
            itemLimitElement.value = defaultItemsPerPage;
        }
    }

    // Try to load saved tabs from localStorage
    const tabsLoaded = loadTabsFromLocalStorage();
    
    // If tabs were loaded successfully, update currentDir to match the active tab
    if (tabsLoaded) {
        const activeTab = fileManagerState.tabs.find(tab => tab.active);
        if (activeTab) {
            currentDir = activeTab.path;
         }
    }

    // Initialize the file manager
    initializeFileManager(csrf, currentDir, isEnc, key);
    
    // Initialize tabs
    renderTabs();
    initTabEvents();
    
    // Initialize theme toggle
    initThemeToggle();

    // Initialize settings
    initSettings();

    // Event listener for "Select All" checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        // Remove existing event listeners and add a fresh one
        selectAllCheckbox.removeEventListener('change', selectAllChangeHandler);
        selectAllCheckbox.addEventListener('change', selectAllChangeHandler);
    }
    
    // Separate handler function for the Select All checkbox
    function selectAllChangeHandler(event) {
        console.log('Select All checkbox changed:', event.target.checked);
        const isChecked = event.target.checked;
        const fileCheckboxes = document.querySelectorAll('.file-checkbox');
        console.log('Found file checkboxes:', fileCheckboxes.length);
        
        // Ensure fileManagerState exists
        if (!window.fileManagerState) {
            window.fileManagerState = { selectedFiles: [] };
        }
        
        // Clear the selected files array first
        window.fileManagerState.selectedFiles = [];
        
        fileCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            
            if (isChecked) {
                // Add to selected files array
                const fullPath = checkbox.dataset.fullPath || checkbox.dataset.file;
                updateSelectedFiles(fullPath, true, true);
                
                // Update row styling
                const row = checkbox.closest('tr');
                row.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
            } else {
                // Update row styling
                const row = checkbox.closest('tr');
                row.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
            }
        });
        
        console.log('Updated selected files:', window.fileManagerState.selectedFiles);
        console.log('Selected file count:', window.fileManagerState.selectedFiles.length);
    }

    // Event listener for individual file checkboxes
    const fileList = document.getElementById('fileList');
    if (fileList) {
        fileList.addEventListener('change', function (event) {
            if (event.target.classList.contains('file-checkbox')) {
                const isChecked = event.target.checked;
                updateSelectedFiles(event.target.dataset.file, isChecked);

                // Update the state of the "Select All" checkbox
                const fileCheckboxes = document.querySelectorAll('.file-checkbox');
                const allChecked = Array.from(fileCheckboxes).every(checkbox => checkbox.checked);
                const anyChecked = Array.from(fileCheckboxes).some(checkbox => checkbox.checked);

                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = allChecked;
                    selectAllCheckbox.indeterminate = !allChecked && anyChecked;
                }
            }
        });
    }

    // Event delegation for delete button
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-trash-alt')) {
            const fileName = event.target.dataset.file;
            deleteFile(fileName, csrf, currentDir, key, isEnc);
        }
    });

    // Function to save currently checked checkboxes to localStorage
    function saveSelectedCheckboxes() {
        const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
            .map(checkbox => checkbox.dataset.file)
            .filter(file => file !== '.' && file !== '..'); // Exclude . and ..

        // Save the selected files to localStorage
        localStorage.setItem('selectedFiles', JSON.stringify(selectedFiles));

        // Return the array of selected files
        return selectedFiles;
    }

    // Add click event for "Create Folder" icon
    $('.fa-folder-plus').click(function () {
        showDialog(
            'Create Folder',
            'Enter the name of new folder: ',
            'mkdir',
            'NewFolder',
            (dirName) => {
                if (dirName) {
                    data = {
                        csrf: csrf,
                        action: 'mkdir',
                        dir: currentDir,
                        dirName: dirName
                    };
                    handleCreate(data, 'folder', key, isEnc, currentDir, csrf);
                }
            }
        );
    });

    // Add click event for "Create File" icon
    $('.fa-file-circle-plus').click(function () {
        showDialog(
            'Create File',
            'Enter the name of new File: ',
            'touch',
            'File',
            (dirName) => {
                if (dirName) {
                    data = {
                        csrf: csrf,
                        action: 'touch',
                        dir: currentDir,
                        dirName: dirName
                    };
                    handleCreate(data, 'file', key, isEnc, currentDir, csrf);
                }
            }
        );
    });

    // Add click event for "Execute PHP" icon
    $('.codeme').click(function () {
        showDialog(
            'Execute PHP Code',
            'Enter the PHP code to execute:',
            'Execute',
            '',
            (phpCode) => {
                if (phpCode && phpCode.trim() !== '') {
                    sendRequest({ 
                        csrf, 
                        action: 'execute', 
                        code: phpCode.trim(), 
                        dir: currentDir 
                    }, key, isEnc)
                    .then(result => {
                        if (result.output) {
                            triggerAlert('success', 'Code executed successfully');
                            // Show the output in a modal or alert
                            Swal.fire({
                                title: 'Execution Result',
                                html: `<pre class="text-left">${result.output}</pre>`,
                                width: '80%',
                                customClass: {
                                    popup: 'dark:bg-gray-800 dark:text-white',
                                    htmlContainer: 'overflow-auto max-h-[70vh]'
                                }
                            });
                        }
                    })
                    .catch(error => {
                        triggerAlert('warning', 'Error executing code: ' + error);
                    });
                }
            }
        );
    });

    // Add search functionality
    $('#searchBar').on('keyup', function() {
        const searchQuery = $(this).val().toLowerCase();
        console.log('Search query:', searchQuery);
        
        // Show/hide clear button based on search content
        if (searchQuery.length > 0) {
            $('#clearSearch').show();
        } else {
            $('#clearSearch').hide();
        }
        
        // Ensure fileManagerState exists
        if (!window.fileManagerState) {
            console.error('fileManagerState is not initialized');
            return;
        }
        
        // Check if renderFiles function is available
        if (typeof window.renderFiles === 'function') {
            window.renderFiles(window.fileManagerState.files, currentDir, csrf, key, isEnc);
        } else {
            console.error('renderFiles function not found');
        }
    });
    
    // Add clear search functionality
    $('#clearSearch').on('click', function() {
        $('#searchBar').val('').focus();
        $(this).hide();
        
        // Re-render files without search filter
        if (typeof window.renderFiles === 'function' && window.fileManagerState) {
            window.renderFiles(window.fileManagerState.files, currentDir, csrf, key, isEnc);
        }
    });
    
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-download')) {
            //// meme
            const filePath = event.target.dataset.file;
            console.log("filePath "+getLastPathSegment(filePath));
            dwn(filePath, csrf, key, isEnc);
        }
    });

    // Infinite scroll
    $(window).on('scroll', function () {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            let itemLimitElement = document.getElementById('itemLimit').value;
            if (fileManagerState.currentPage < fileManagerState.totalPages && !fileManagerState.isLoading) {
                // alert(fileManagerState.currentPage);
                fileManagerState.currentPage++;
                loadDirectory(currentDir, fileManagerState.currentPage, csrf, key, isEnc,itemLimitElement);
            }
        }
    });

    // Add sorting functionality
    $('th[data-sort]').click(function () {
        const column = $(this).data('sort'); // Get the column to sort by
        console.log('Sorting by column:', column);

        // Ensure fileManagerState exists
        if (!window.fileManagerState) {
            console.error('fileManagerState is not initialized');
            return;
        }

        // Update sorting state
        if (window.fileManagerState.currentSort.column === column) {
            // Toggle direction if the same column is clicked
            window.fileManagerState.currentSort.direction = 
                window.fileManagerState.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            // Set new column and default to ascending order
            window.fileManagerState.currentSort.column = column;
            window.fileManagerState.currentSort.direction = 'asc';
        }
        
        console.log('Sort state:', window.fileManagerState.currentSort);

        // Sort and re-render files
        if (typeof window.sortFiles === 'function') {
            window.sortFiles();
        } else {
            console.error('sortFiles function not found');
        }
        
        if (typeof window.renderFiles === 'function') {
            window.renderFiles(window.fileManagerState.files, currentDir, csrf, key, isEnc);
        } else {
            console.error('renderFiles function not found');
        }
        
        // Add visual feedback for the sort direction
        $('th[data-sort]').find('i.fas').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
        const icon = $(this).find('i.fas');
        icon.removeClass('fa-sort');
        if (window.fileManagerState.currentSort.direction === 'asc') {
            icon.addClass('fa-sort-up');
        } else {
            icon.addClass('fa-sort-down');
        }
    });

    // Event listener for directory links
    $(document).on('click', '.directory-link', function (e) {
        e.preventDefault();
        let itemLimitElement = document.getElementById('itemLimit').value;

        const newDir = $(this).data('path');
        if (newDir && newDir !== currentDir) {
            currentDir = newDir;  
            updir = currentDir;
            console.log(updir);
            updateCurrentPath(); 
            loadDirectory(currentDir, 1, csrf, key, isEnc,itemLimitElement);  
            
            // Update the active tab's path
            updateActiveTabPath(currentDir);
        }
    });

    // Function to update the current path in the UI - make globally available
    window.updateCurrentPath = function() {
        updateBreadcrumbs(currentDir); // Update breadcrumbs
    }

    // Function to generate simple breadcrumbs
    function updateBreadcrumbs(path) {
        const breadcrumbsContainer = $('#breadcrumbs ol');
        const parts = path.split('/').filter(part => part !== ''); // Split path into parts
        let breadcrumbsHtml = '';

        // Add Home link
        breadcrumbsHtml += `
            <li class="inline-flex items-center">
                <a href="#" class="breadcrumb-link" data-path="/">
                    /
                </a>
            </li>
        `;

        // Add other parts of the path
        parts.forEach((part, index) => {
            const partialPath = '/' + parts.slice(0, index + 1).join('/'); // Build partial path
            breadcrumbsHtml += `
                <li class="inline-flex items-center">
                    <i class="fas fa-chevron-right mx-2 text-gray-500"></i>
                    <a href="#" class="breadcrumb-link" data-path="${partialPath}">${part}</a>
                </li>
            `;
        });

        breadcrumbsContainer.html(breadcrumbsHtml);
    }

    // Add double-click event listener to the #breadcrumbs element
    $('#breadcrumbs').on('dblclick', function (e) {
        console.log('Double-click detected');
        e.preventDefault(); // Prevent default behavior

        const $container = $('#breadcrumbs ol');
        const originalPath = currentDir; // Get the current path (or use a custom variable)
        const $input = $('<input>', {
            type: 'text',
            value: originalPath,
            class: 'w-96 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
        });
        console.log('originalPath' + originalPath);

        // Replace the entire breadcrumb with the input field
        $container.html(`<li class="inline-flex items-center">${$input.prop('outerHTML')}</li>`);

        // Focus the input field
        $container.find('input').focus();

        // Handle input field blur (when focus is lost)
        $container.find('input').on('blur', function () {
            const newPath = $(this).val().trim();
            
            // Restore the breadcrumbs
                updateBreadcrumbs(originalPath);
        });

        // Handle Enter key press
        $container.find('input').on('keydown', function (e) {
            if (e.keyCode === 13) { // Enter key
                e.preventDefault();
                const newPath = $(this).val().trim();
                
                // Navigate to the new path
                if (newPath) {
                    currentDir = newPath;
                    updateCurrentPath();
                    loadDirectory(currentDir, 1, csrf, key, isEnc);
                    updateActiveTabPath(currentDir);
                }
            }
        });
    });

    // Event listener for breadcrumb links
    $(document).on('click', '.breadcrumb-link', function (e) {
        e.preventDefault();
        const newDir = $(this).data('path');
        if (newDir) {
            currentDir = newDir; // Update current directory
            updateCurrentPath(); // Update the UI
            updir = currentDir;
            console.log(updir);
            
            // Get current items per page setting
            let itemLimitElement = document.getElementById('itemLimit');
            let itemsPerPage = itemLimitElement ? itemLimitElement.value : '50';
            
            loadDirectory(currentDir, 1, csrf, key, isEnc, itemsPerPage); // Load the new directory
            
            // Update the active tab's path
            updateActiveTabPath(currentDir);
        }
    });
    
    // Event listener for home button
    $(document).on('click', '#goHome', function(e) {
        e.preventDefault();
        // Navigate to home directory
        currentDir = homeDir;
        updateCurrentPath();
        updir = currentDir;
        
        // Get current items per page setting
        let itemLimitElement = document.getElementById('itemLimit');
        let itemsPerPage = itemLimitElement ? itemLimitElement.value : '50';
        
        loadDirectory(currentDir, 1, csrf, key, isEnc, itemsPerPage);
        
        // Update the active tab's path
        updateActiveTabPath(currentDir);
        
        // Add visual feedback for the action
        $(this).addClass('animate-pulse');
        setTimeout(() => {
            $(this).removeClass('animate-pulse');
        }, 300);
    });
    
    // Tabs functionality
    function renderTabs() {
        const tabsContainer = document.getElementById('location-tabs');
        if (!tabsContainer) return;
        
        tabsContainer.innerHTML = '';
        
        fileManagerState.tabs.forEach(tab => {
            const tabElement = document.createElement('li');
            tabElement.className = 'mr-1 flex-shrink-0';
            tabElement.setAttribute('role', 'presentation');
            
            // Get the last part of the path for the tab name if not custom named
            const displayName = tab.name || getLastPathSegment(tab.path);
            
            // Determine icon based on the path
            let tabIcon = 'fa-folder';
            if (displayName === 'Root' || displayName === 'Home') {
                tabIcon = 'fa-home';
            }
            
            // Define the active and inactive classes for better styling
            const activeClasses = 'inline-flex items-center p-3 border-b-2 rounded-t-lg text-blue-600 border-blue-600 active dark:text-blue-500 dark:border-blue-500 bg-white dark:bg-gray-800 shadow-sm';
            const inactiveClasses = 'inline-flex items-center p-3 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 dark:hover:border-gray-300 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600';
            
            tabElement.innerHTML = `
                <button class="${tab.active ? activeClasses : inactiveClasses} transition-all duration-200 group" 
                        data-tab-id="${tab.id}" 
                        type="button" 
                        role="tab">
                    <i class="fas ${tabIcon} mr-2 ${tab.active ? 'text-blue-500' : 'group-hover:text-blue-400'} transition-colors"></i>
                    <span class="truncate max-w-[100px] md:max-w-[150px]">${displayName}</span>
                    ${tab.id !== 'tab-1' ? `
                        <i class="fas fa-times ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full text-xs opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" data-close-tab="${tab.id}"></i>
                    ` : ''}
                </button>
            `;
            
            tabsContainer.appendChild(tabElement);
        });
        
        // Add a subtle animation to the active tab
        const activeTab = tabsContainer.querySelector('button[data-tab-id="' + fileManagerState.activeTabId + '"]');
        if (activeTab) {
            activeTab.classList.add('animate-pulse');
            setTimeout(() => {
                activeTab.classList.remove('animate-pulse');
            }, 500);
            
            // Ensure active tab is visible (scroll into view if needed)
            requestAnimationFrame(() => {
                const tabRect = activeTab.getBoundingClientRect();
                const containerRect = tabsContainer.getBoundingClientRect();
                
                if (tabRect.left < containerRect.left) {
                    tabsContainer.scrollLeft += tabRect.left - containerRect.left - 16;
                } else if (tabRect.right > containerRect.right) {
                    tabsContainer.scrollLeft += tabRect.right - containerRect.right + 16;
                }
            });
        }
        
        // Add scroll indicators if tabs overflowing
        checkTabOverflow();
    }
    
    function checkTabOverflow() {
        const tabsContainer = document.getElementById('location-tabs');
        if (!tabsContainer) return;
        
        // Calculate if tabs are overflowing
        const isOverflowing = tabsContainer.scrollWidth > tabsContainer.clientWidth;
        
        // Toggle overflow indicator class
        if (isOverflowing) {
            tabsContainer.classList.add('tabs-overflow');
            
            // Add scroll buttons if not already present
            if (!document.getElementById('tab-scroll-left')) {
                const scrollLeftBtn = document.createElement('button');
                scrollLeftBtn.id = 'tab-scroll-left';
                scrollLeftBtn.className = 'absolute left-0 top-0 bottom-0 px-1 bg-gradient-to-r from-white to-transparent dark:from-gray-800 dark:to-transparent z-10 opacity-80 hover:opacity-100 transition-opacity';
                scrollLeftBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
                scrollLeftBtn.addEventListener('click', () => {
                    tabsContainer.scrollBy({ left: -150, behavior: 'smooth' });
                });
                
                const scrollRightBtn = document.createElement('button');
                scrollRightBtn.id = 'tab-scroll-right';
                scrollRightBtn.className = 'absolute right-0 top-0 bottom-0 px-1 bg-gradient-to-l from-white to-transparent dark:from-gray-800 dark:to-transparent z-10 opacity-80 hover:opacity-100 transition-opacity';
                scrollRightBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
                scrollRightBtn.addEventListener('click', () => {
                    tabsContainer.scrollBy({ left: 150, behavior: 'smooth' });
                });
                
                tabsContainer.parentElement.appendChild(scrollLeftBtn);
                tabsContainer.parentElement.appendChild(scrollRightBtn);
            }
        } else {
            tabsContainer.classList.remove('tabs-overflow');
            // Remove scroll buttons if present
            document.getElementById('tab-scroll-left')?.remove();
            document.getElementById('tab-scroll-right')?.remove();
        }
    }
    
    function initTabEvents() {
        // Tab click event
        $(document).on('click', '#location-tabs button', function(e) {
            if (e.target.classList.contains('fa-times')) return; // Don't switch tabs when clicking the close button
            
            const tabId = $(this).data('tab-id');
            
            // Find the tab to determine its type
            const tab = fileManagerState.tabs.find(t => t.id === tabId);
            if (!tab) return;
            
            // Hide all system tab contents first
            document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
                panel.classList.add('hidden');
            });
            
            // Hide any system tabs that might be visible
            document.querySelectorAll('[data-tabs-target]').forEach(tab => {
                const target = tab.getAttribute('data-tabs-target');
                if (target && document.querySelector(target)) {
                    document.querySelector(target).classList.add('hidden');
                }
            });
            
            // Switch to the selected tab
            switchToTab(tabId);
            
            // Add click ripple effect
            const ripple = document.createElement('span');
            ripple.className = 'absolute inset-0 bg-blue-500 opacity-30 rounded-t-lg animate-ripple';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
        
        // Close tab event with animation
        $(document).on('click', '[data-close-tab]', function(e) {
            e.stopPropagation();
            const tabId = $(this).data('close-tab');
            const tabElement = $(this).closest('li');
            
            // Add closing animation
            tabElement.addClass('animate-tab-closing');
            setTimeout(() => {
                closeTab(tabId);
            }, 150);
        });
        
        // Add new tab button
        $('#add-tab-btn').click(function() {
            addNewTab();
            
            // Add pulse animation to the button
            $(this).addClass('animate-pulse');
            setTimeout(() => {
                $(this).removeClass('animate-pulse');
            }, 500);
        });
        
        // Check tab overflow on window resize
        window.addEventListener('resize', debounce(checkTabOverflow, 100));
    }
    
    // Utility function for debouncing
    function debounce(func, wait) {
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
    
    // Make switchToTab available globally
    window.switchToTab = function(tabId) {
        // Find the tab
        const tab = fileManagerState.tabs.find(t => t.id === tabId);
        if (!tab) return;
        
        // Set all tabs to inactive
        fileManagerState.tabs.forEach(t => t.active = false);
        
        // Set the selected tab to active
        tab.active = true;
        fileManagerState.activeTabId = tabId;
        
        // Update the UI
        renderTabs();
        
        // Hide all system tab contents first
        document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        // Get tab content element or create it if it doesn't exist
        let tabContentEl = document.getElementById(`${tabId}-content`);
        if (!tabContentEl && (tab.type === 'editor' || tab.type === 'search')) {
            console.log('Creating tab content element for tab:', tabId);
            const tabsContent = document.getElementById('tabs-content');
            if (!tabsContent) {
                console.error('Tabs content container not found!');
                return;
            }
            
            tabContentEl = document.createElement('div');
            tabContentEl.id = `${tabId}-content`;
            tabContentEl.className = 'tabs-panel w-full';
            tabsContent.appendChild(tabContentEl);
        }
        
        // Hide all tab contents
        document.querySelectorAll('.tabs-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        // Load content based on tab type
        const fileManagerUI = document.getElementById('fileManagerUI');
        
        if (tab.type === 'editor' || tab.type === 'search') {
            console.log('Handling editor/search tab');
            // Editor or search tab - hide fileManagerUI
            if (fileManagerUI) {
                console.log('Hiding fileManagerUI');
                fileManagerUI.classList.add('hidden');
                fileManagerUI.style.display = 'none';
            } else {
                console.warn('fileManagerUI element not found');
            }
        
        // Show this tab's content
            if (tabContentEl) {
        tabContentEl.classList.remove('hidden');
            
            // Make sure the editor container has full height
            const editorContainer = tabContentEl.querySelector('.editor-container');
            if (editorContainer) {
                editorContainer.style.height = '90vh';
                editorContainer.style.width = '100%';
                
                // Refresh the editor if it exists
                if (window.editor) {
                    setTimeout(() => window.editor.refresh(), 10);
                }
                }
            } else {
                console.error('Tab content not found for ID:', `${tabId}-content`);
            }
        } else {
             // File manager tab - show fileManagerUI and the file tab content
            const fileTabContent = document.getElementById('file');
            
            if (fileManagerUI) {
                console.log('Showing fileManagerUI');
                fileManagerUI.classList.remove('hidden');
                fileManagerUI.style.display = 'block';
                
                // Make sure the file tab is visible
                if (fileTabContent) {
                    fileTabContent.classList.remove('hidden');
                }
                
                // Always reload the directory when switching to a file manager tab
                currentDir = tab.path;
                updateCurrentPath();
                
                // Get current items per page setting
                let itemLimitElement = document.getElementById('itemLimit');
                let itemsPerPage = itemLimitElement ? itemLimitElement.value : '50';
                
                loadDirectory(currentDir, 1, csrf, key, isEnc, itemsPerPage);
            } else {
                console.warn('fileManagerUI element not found');
            }
        }
        
        // Save tabs state to localStorage
        saveTabsToLocalStorage();
    }
    
    // Local function is just a wrapper for the global one
    function switchToTab(tabId) {
        window.switchToTab(tabId);
    }
    
    function closeTab(tabId) {
        // Don't close the last tab
        if (fileManagerState.tabs.length <= 1) return;
        
        // Find the tab index
        const tabIndex = fileManagerState.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;
        
        // Check if this is the active tab
        const isActiveTab = fileManagerState.tabs[tabIndex].active;
        
        // Get the tab type before removing it
        const closedTabType = fileManagerState.tabs[tabIndex].type;
        
        // If this is an editor tab, remove the file from the tracking
        if (closedTabType === 'editor') {
            const filePath = fileManagerState.tabs[tabIndex].path;
            if (filePath && window.saveOpenedFilesState) {
                window.saveOpenedFilesState(filePath, 'remove');
            }
        }
        
        // Remove the tab
        fileManagerState.tabs.splice(tabIndex, 1);
        
        // If we closed the active tab, switch to another tab
        if (isActiveTab) {
            // Switch to the previous tab, or the first tab if there is no previous
            const newActiveIndex = Math.max(0, tabIndex - 1);
            fileManagerState.tabs[newActiveIndex].active = true;
            fileManagerState.activeTabId = fileManagerState.tabs[newActiveIndex].id;
            
            // Get the new active tab type
            const newActiveTabType = fileManagerState.tabs[newActiveIndex].type;
            
            // Handle fileManagerUI visibility based on the new active tab type
            const fileManagerUI = document.getElementById('fileManagerUI');
            if (fileManagerUI) {
                if (newActiveTabType === 'filemanager') {
                    // Show fileManagerUI for filemanager tabs
                    fileManagerUI.classList.remove('hidden');
                    fileManagerUI.style.display = 'block';
                    
                    // Hide all editor tab contents
                    document.querySelectorAll('.tabs-panel').forEach(panel => {
                        panel.classList.add('hidden');
                    });
            
            // Update current directory
            currentDir = fileManagerState.tabs[newActiveIndex].path;
            updateCurrentPath();
            
            // Get current items per page setting
            let itemLimitElement = document.getElementById('itemLimit');
            let itemsPerPage = itemLimitElement ? itemLimitElement.value : '50';
            
            loadDirectory(currentDir, 1, csrf, key, isEnc, itemsPerPage);
                } else {
                    // Hide fileManagerUI for other tab types
                    fileManagerUI.classList.add('hidden');
                    fileManagerUI.style.display = 'none';
                    
                    // Show the specific editor tab content
                    const tabContent = document.getElementById(`${fileManagerState.activeTabId}-content`);
                    if (tabContent) {
                        // Hide all tab panels first
                        document.querySelectorAll('.tabs-panel').forEach(panel => {
                            panel.classList.add('hidden');
                        });
                        
                        // Show the active tab content
                        tabContent.classList.remove('hidden');
                        
                        // Refresh editor if it exists
                        if (window.editor) {
                            setTimeout(() => window.editor.refresh(), 10);
                        }
                    }
                }
            }
        }
        
        // Update the UI
        renderTabs();
        
        // Save tabs state to localStorage
        saveTabsToLocalStorage();
    }
    
    // Make the function available globally for utils.js
    window.addNewTab = function(tabName = null, type = 'filemanager') {
        // Generate a unique ID for the new tab
        const newTabId = `tab-${Date.now()}`;
        
        // Set all tabs to inactive
        fileManagerState.tabs.forEach(t => t.active = false);
        
        // Add the new tab
        fileManagerState.tabs.push({
            id: newTabId,
            path: currentDir, // Use the current directory as the starting point
            active: true,
            name: tabName || getLastPathSegment(currentDir),
            type: type // Add type: 'filemanager' or 'editor'
        });
        
        fileManagerState.activeTabId = newTabId;
        
        // Update the UI
        renderTabs();
        
        // Handle the fileManagerUI visibility based on tab type
        const fileManagerUI = document.getElementById('fileManagerUI');
        if (fileManagerUI) {
            if (type === 'filemanager') {
                // Show fileManagerUI for filemanager tabs
                fileManagerUI.classList.remove('hidden');
                fileManagerUI.style.display = 'block';
                
                // Hide all editor tab contents
                document.querySelectorAll('.tabs-panel').forEach(panel => {
                    panel.classList.add('hidden');
                });
            } else {
                // Hide fileManagerUI for other tab types
                fileManagerUI.classList.add('hidden');
                fileManagerUI.style.display = 'none';
            }
        }
        
        // Save tabs state to localStorage
        saveTabsToLocalStorage();
        
        // Return the ID of the new tab
        return newTabId;
    }
    
    // Keeping local function for backwards compatibility
    function addNewTab(tabName, type = 'filemanager') {
        return window.addNewTab(tabName, type);
    }
    
    // Make the function available globally for utils.js
    window.updateActiveTabPath = function(newPath) {
        // Find the active tab
        const activeTab = fileManagerState.tabs.find(t => t.id === fileManagerState.activeTabId);
        if (activeTab) {
            activeTab.path = newPath;
            activeTab.name = getLastPathSegment(newPath);
            renderTabs();
            
            // Save tabs state to localStorage
            saveTabsToLocalStorage();
        }
    }
    
    function getLastPathSegment(path) {
        // Remove trailing slash if present
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        
        // If it's the root directory
        if (cleanPath === '' || cleanPath === '/') {
            return 'Root';
        }
        
        // Get the last segment
        const segments = cleanPath.split('/');
        return segments[segments.length - 1] || 'Root';
    }

    // New Bulk Actions Implementation
    $('#bulkActions').change(function () {
        const action = $(this).val(); // Get selected action
        
        // Reset dropdown immediately to prevent accidental resubmission
        setTimeout(() => {
            $(this).val('');
        }, 100);
        
        // Get the current selected files directly from checkboxes
        const getSelectedFiles = () => {
        const checkedBoxes = document.querySelectorAll('.file-checkbox:checked');
            const selectedFiles = [];
            
                checkedBoxes.forEach(checkbox => {
                // Prefer full path if available
                const filePath = checkbox.dataset.fullPath || checkbox.dataset.file;
                if (filePath) {
                    selectedFiles.push(filePath);
                    }
                });
            
            return selectedFiles;
        };
        
        // Get selected files
        const selectedFiles = getSelectedFiles();
        
        // Log selection information
        console.log('Bulk action triggered:', action);
        console.log('Selected files:', selectedFiles);
        console.log('Selected files count:', selectedFiles.length);

        // Check if we have files selected (except for paste action)
        if (selectedFiles.length === 0 && action !== 'paste') {
            triggerAlert('info', 'No files selected! Please select files to perform bulk actions.');
            return;
        }

        // Handle different actions
        switch (action) {
            case 'delete':
                // Show confirmation dialog for bulk delete
                showConfirmation(
                    'Delete Files',
                    `Are you sure you want to delete ${selectedFiles.length} file(s)?`,
                    'Delete',
                    () => {
                        // Get fresh selection in case it changed
                        const filesToDelete = getSelectedFiles();
                        
                        if (filesToDelete.length > 0) {
                            console.log('Sending files for deletion:', filesToDelete);
                            
                            // Send the delete request
                            sendBulkActionRequest({
                                action: 'delete',
                                files: filesToDelete,
                                onSuccess: () => {
                                    // Clear selection after successful operation
                                    clearFileSelection();
                                    triggerAlert('success', 'Files deleted successfully');
                                    loadDirectory(currentDir, 1, csrf, key, isEnc);
                                }
                            });
                        } else {
                            triggerAlert('warning', 'No files selected for deletion.');
                        }
                    }
                );
                break;

            case 'zip':
                // Show enhanced dialog for zip file creation with compression options
                showZipCreationDialog(
                    'Create Zip Archive',
                    'Enter the name for the zip file:',
                    'Create',
                    'archive.zip',
                    (zipOptions) => {
                        if (zipOptions) {
                            // Get fresh selection
                            const filesToZip = getSelectedFiles();
                            
                            if (filesToZip.length === 0) {
                                triggerAlert('warning', 'No files selected for archiving.');
                                return;
                            }
                            
                            // Format the filename with correct extension
                            const format = zipOptions.archiveFormat;
                            let filename = zipOptions.zipFileName;
                            
                            // Ensure filename has correct extension
                            if (!filename.toLowerCase().endsWith('.' + format)) {
                                // Remove any existing extension
                                if (filename.includes('.')) {
                                    filename = filename.substring(0, filename.lastIndexOf('.'));
                                }
                                // Add the correct extension
                                filename += '.' + format;
                            }
                            
                            zipOptions.zipFileName = filename;
                            
                            // Send the zip request
                            sendBulkActionRequest({
                                action: 'zip',
                                files: filesToZip,
                                options: zipOptions,
                                onSuccess: () => {
                                    // Clear selection after successful operation
                                    clearFileSelection();
                                    triggerAlert('success', 'Archive created successfully');
                                    loadDirectory(currentDir, 1, csrf, key, isEnc);
                                }
                            });
                        }
                    }
                );
                break;

            case 'unzip':
                // Check if multiple files are selected and they have different extensions
                if (selectedFiles.length > 1) {
                    const extensions = selectedFiles.map(file => {
                        const ext = file.split('.').pop().toLowerCase();
                        // Handle compound extensions
                        if (['gz', 'bz2', 'xz'].includes(ext)) {
                            const baseName = file.substring(0, file.lastIndexOf('.'));
                            if (baseName.toLowerCase().endsWith('.tar')) {
                                return `tar.${ext}`;
                            }
                        }
                        return ext;
                    });
                    
                    // Check if all extensions are the same
                    const allSameType = extensions.every(ext => ext === extensions[0]);
                    
                    if (!allSameType) {
                        // Show warning for mixed archive types
                showConfirmation(
                            'Warning: Different Archive Types',
                            'You\'ve selected different types of archives. This may cause extraction issues. Continue anyway?',
                            'Continue',
                            () => {
                                // Get fresh selection
                                const filesToExtract = getSelectedFiles();
                                
                                if (filesToExtract.length > 0) {
                                    // Send the unzip request
                                    sendBulkActionRequest({
                                        action: 'unzip',
                                        files: filesToExtract,
                                        onSuccess: () => {
                                            // Clear selection after successful operation
                                            clearFileSelection();
                                            triggerAlert('success', 'Archives extracted successfully');
                                            loadDirectory(currentDir, 1, csrf, key, isEnc);
                                        }
                                    });
                                }
                            }
                        );
                        return;
                    }
                }
                
                // Show extract confirmation
                showConfirmation(
                    'Extract Archive',
                    selectedFiles.length > 1 
                        ? `Extract ${selectedFiles.length} archives to the current directory?` 
                        : `Extract "${selectedFiles[0]}" to the current directory?`,
                    'Extract',
                    () => {
                        // Get fresh selection
                        const filesToExtract = getSelectedFiles();
                        
                        if (filesToExtract.length > 0) {
                                                    // Send the unzip request
                        sendBulkActionRequest({
                            action: 'unzip',
                            files: filesToExtract,
                            onSuccess: () => {
                                // Clear selection after successful operation
                                clearFileSelection();
                                triggerAlert('success', 'Archives extracted successfully');
                                loadDirectory(currentDir, 1, csrf, key, isEnc);
                            }
                        });
                        }
                    }
                );
                break;

            case 'copy':
                // Save selected files to clipboard
                if (selectedFiles.length > 0) {
                    // Ensure all paths are absolute
                    const filesWithPaths = selectedFiles.map(file => {
                    if (!file.includes('/')) {
                        return `${currentDir}/${file}`;
                    }
                    return file;
                });
                    
                    // Save to localStorage
                    localStorage.setItem('copiedFiles', JSON.stringify(filesWithPaths));
                    triggerAlert('success', `${selectedFiles.length} file(s) copied to clipboard`);
                }
                break;

            case 'paste':
                // Get files from clipboard
                try {
                    const clipboardFiles = JSON.parse(localStorage.getItem('copiedFiles') || '[]');
                    
                    if (clipboardFiles.length > 0) {
                        // Send the paste request
                        sendBulkActionRequest({
                            action: 'paste',
                            files: clipboardFiles,
                            onSuccess: () => {
                                // Clear selection after successful operation
                                clearFileSelection();
                                triggerAlert('success', 'Files pasted successfully');
                                loadDirectory(currentDir, 1, csrf, key, isEnc);
                                // Clear clipboard after successful paste
                                localStorage.removeItem('copiedFiles');
                            }
                        });
                } else {
                        triggerAlert('warning', 'No files in clipboard to paste');
                }
                } catch (error) {
                    console.error('Error reading clipboard:', error);
                    triggerAlert('error', 'Failed to read clipboard data');
                }
                break;
                
            case 'telegram_backup':
                // Show confirmation dialog for Telegram backup
                showConfirmation(
                    'Secure Backup to Telegram',
                    `Are you sure you want to backup ${selectedFiles.length} file(s) to Telegram? All files and folders will be compressed with maximum compression (level 9) and protected with strong AES-256 encryption using a random password.`,
                    'Secure Backup',
                    () => {
                        // Get fresh selection in case it changed
                        const filesToBackup = getSelectedFiles();
                        
                        if (filesToBackup.length > 0) {
                            console.log('Sending files for Telegram backup:', filesToBackup);
                            
                            // Show loading message
                            triggerAlert('info', 'Sending files to Telegram with maximum compression and password protection. This may take a while for large files...');
                            
                            // Send the backup request
                            sendBulkActionRequest({
                                action: 'telegram_backup',
                                files: filesToBackup,
                                onSuccess: (result) => {
                                    // Clear selection after successful operation
                                    clearFileSelection();
                                    
                                    // Check for different response types
                                    if (result.status === 'Backup started in background') {
                                        triggerAlert('info', 'Backup started in background. You can continue using the app.');
                                    } else if (result.success) {
                                        triggerAlert('success', result.success);
                                    } else if (result.warning) {
                                        triggerAlert('warning', result.warning);
                                    } else {
                                        triggerAlert('success', 'Files are being backed up.');
                                    }
                                },
                                onError: (error) => {
                                    triggerAlert('error', 'Failed to backup files: ' + error);
                                }
                            });
                        } else {
                            triggerAlert('warning', 'No files selected for backup.');
                        }
                    }
                );
                break;

            default:
                console.log('Unknown action:', action);
                break;
        }
    });
    
    // Helper function to send bulk action requests
    function sendBulkActionRequest({ action, files, options = null, onSuccess = null, onError = null }) {
        // Show progress indicator
        progr();
        
        // Prepare request data
        const requestData = {
            action: action,
            file: files,
            dir: currentDir,
            csrf: csrf
        };
        
        if (options) {
            Object.assign(requestData, options);
        }
        
        // Convert to JSON
        const jsonData = JSON.stringify(requestData);
        
        // Encrypt if needed
        const data = (isEnc === '1') ? encrypt(jsonData, key) : jsonData;
        
        // For background processes like telegram_backup, use fetch with timeout
        if (action === 'telegram_backup') {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
            
            fetch('', {
                method: 'POST',
                body: data,
                signal: controller.signal
            })
            .then(response => {
                // Immediately cancel the timeout when we get headers
                clearTimeout(timeoutId);
                
                // Check if response is ok (status 200-299)
                if (!response.ok) {
                    throw new Error('Network response was not ok');
        }
        
                // Read the response as text
                return response.text();
            })
            .then(response => {
                try {
                    const decryptedResponse = (isEnc === '1') ? decrypt(response, key) : response;
                    const result = JSON.parse(decryptedResponse);
                    
                    if (result.error) {
                        triggerAlert('warning', result.error);
                        if (onError) onError(result.error);
                    } else {
                        if (onSuccess) onSuccess(result);
                    }
                } catch (error) {
                    console.error('Error processing response:', error);
                    triggerAlert('error', 'Failed to process server response');
                    if (onError) onError(error);
                }
                dprogr();
            })
            .catch(error => {
                if (error.name === 'AbortError') {
                    // Expected for background processes
                    console.log('Background process started');
                    if (onSuccess) {
                        onSuccess({ status: 'Backup started in background' });
                    }
                } else {
                    console.error('Request failed:', error);
                    triggerAlert('error', 'Request failed: ' + error.message);
                    if (onError) onError(error);
                }
                dprogr();
            });
        } else {
            // For regular requests, use existing jQuery ajax
            $.post('', data, function(response) {
            try {
                // Decrypt response if needed
                const decryptedResponse = (isEnc === '1') ? decrypt(response, key) : response;
                const result = JSON.parse(decryptedResponse);
                
                console.log('Response:', result);
                
                if (result.error) {
                    triggerAlert('warning', result.error);
                    if (onError) onError(result.error);
                } else if (result.success) {
                    if (onSuccess) onSuccess(result);
                    else triggerAlert('success', result.success);
                } else {
                    if (onSuccess) onSuccess(result);
                    else triggerAlert('success', 'Operation completed successfully');
                }
            } catch (error) {
                console.error('Error processing response:', error);
                triggerAlert('error', 'Failed to process server response');
                if (onError) onError(error);
            }
            
            // Hide progress indicator
            dprogr();
        }).fail(function(xhr, status, error) {
            console.error('Request failed:', status, error);
            triggerAlert('error', 'Request failed: ' + (error || 'Unknown error'));
            if (onError) onError(error);
            dprogr();
        });
        }
    }

    // Upload functionality
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (dropZone && fileInput && uploadForm && uploadProgress && progressBar && progressText) {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop zone when dragging files over it
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('bg-blue-50', 'dark:bg-gray-600'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('bg-blue-50', 'dark:bg-gray-600'), false);
        });

        // Handle dropped files
        dropZone.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files; // Assign dropped files to the file input
                updir = currentDir;
                handleFiles(updir);
            }
        }

        // Handle file input change
        fileInput.addEventListener('change', handleFiles);

        // Click on drop zone to trigger file input
        dropZone.addEventListener('click', () => fileInput.click());

        // Function to handle files
        function handleFiles(updir) {
            uploadProgress.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = 'Uploading...';

            const formData = new FormData(uploadForm);
            formData.append('updir', currentDir);
            formData.append('csrf', csrf); // Append CSRF token

            fetch('', {
                method: 'POST',
                body: formData,
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        progressText.textContent = 'Upload complete!';
                        setTimeout(() => uploadProgress.classList.add('hidden'), 3000);
                        loadDirectory(currentDir, 1, csrf, key, isEnc); // Refresh file list
                    } else {
                        progressText.textContent = data.error || 'Upload failed. Please try again.';
                    }
                })
                .catch(error => {
                    progressText.textContent = 'Upload failed. Please try again.';
                    console.error('Error:', error);
                });
        }
    }


    document.addEventListener('click', function (event) {
     
        if (event.target.classList.contains('file-link')) {
            event.preventDefault(); // Prevent the default link behavior
            const filePath = event.target.dataset.file; // Get the file path
            viewEditFile(filePath, csrf, key, isEnc); // Call the viewEditFile function
        }
     
        
    });
 

    

    // Function to initialize editor-related event listeners
    function initEditorEventListeners() {
        const cancelEdit = document.getElementById('cancelEdit');
        const cancelEditBtn = document.getElementById('cancelEditBtn');
        const editorLanguage = document.getElementById('editorLanguage');
        const saveFile = document.getElementById('saveFile');
        
        if (cancelEdit) {
            cancelEdit.addEventListener('click', function () {
                const editorModal = document.getElementById('editorModal');
                if (editorModal) {
                    editorModal.classList.add('hidden');
                }
        // No need to dispose CodeMirror, it can be reused
    });
        }

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', function () {
                const editorModal = document.getElementById('editorModal');
                if (editorModal) {
                    editorModal.classList.add('hidden');
                }
        // No need to dispose CodeMirror, it can be reused
    });
        }

        if (editorLanguage) {
            editorLanguage.addEventListener('change', function () {
        if (window.editor) {
            const newLanguage = this.value;
            // Map to CodeMirror mode
            const modeMap = {
                'javascript': 'javascript',
                'php': 'php',
                'html': 'htmlmixed',
                'css': 'css',
                'json': 'javascript',
                'plaintext': 'null'
            };
            const mode = modeMap[newLanguage] || 'null';
            
            // Update the editor mode
            window.editor.setOption('mode', mode);
                    
                    const editorStatus = document.getElementById('editorStatus');
                    if (editorStatus) {
                        editorStatus.textContent = `Language changed to ${newLanguage}`;
                    }
        }
    });
        }

        if (saveFile) {
            saveFile.addEventListener('click', function () {
        // Get content from CodeMirror editor
        const newContent = window.editor ? window.editor.getValue() : '';
                const editorModal = document.getElementById('editorModal');
                const filePath = editorModal && editorModal.dataset.filePath ? editorModal.dataset.filePath : '';
        
                const editorStatus = document.getElementById('editorStatus');
                if (editorStatus) {
                    editorStatus.textContent = 'Saving...';
                }

        saveFileContent(filePath, newContent, csrf, key, isEnc);
    });
        }
    }
    
    // Call the function after DOM has loaded
    initEditorEventListeners();

    function saveFileContent(filePath, content, csrf, key, isEnc) {
        progr();
        console.log('Saving file content for:', filePath);
        
        if (!content) {
            triggerAlert('warning', 'File content is empty.');
            dprogr();
            return;
        }

        if (!filePath) {
            triggerAlert('warning', 'No file path specified.');
            dprogr();
            return;
        }
        
        // Find the tab content that contains the editor
        const tabContent = document.querySelector(`[data-file-path="${filePath}"]`);
        let fileType = '';
        
        // If we found the tab, try to get the selected file type
        if (tabContent) {
            const tabId = tabContent.id.replace('-content', '');
            const typeSelect = document.getElementById(`file-type-select-${tabId}`);
            if (typeSelect) {
                fileType = typeSelect.value;
            }
        }
        
        sendRequest({ 
            csrf, 
            action: 'save_content', 
            file: filePath, 
            content: content,
            file_type: fileType // Include the file type when saving
        }, key, isEnc)
            .then(response => {
                console.log('File saved successfully:', response);
                triggerAlert('success', 'File saved successfully');
                dprogr();
            })
            .catch(error => {
                console.error('Error saving file:', error);
                triggerAlert('danger', 'Failed to save file: ' + error);
                dprogr();
            });
    }

    function getLanguageFromFileName(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        switch (extension) {
            case 'js': return 'javascript';
            case 'php': return 'php';
            case 'html': case 'htm': return 'htmlmixed';
            case 'css': return 'css';
            case 'json': return 'application/json';
            case 'xml': return 'xml';
            case 'md': return 'markdown';
            case 'py': return 'python';
            case 'rb': return 'ruby';
            case 'java': return 'text/x-java';
            case 'c': return 'text/x-csrc';
            case 'cpp': case 'cc': case 'h': case 'hpp': return 'text/x-c++src';
            case 'cs': return 'text/x-csharp';
            case 'go': return 'text/x-go';
            case 'rs': return 'text/x-rustsrc';
            case 'ts': return 'text/typescript';
            case 'sql': return 'sql';
            case 'sh': case 'bash': return 'shell';
            case 'yml': case 'yaml': return 'yaml';
            case 'txt': return 'text';
            default: return 'plaintext';
        }
    }

    function viewEditFile(filePath, csrf, key, isEnc) {
        // Show progress indicator
        progr();
        console.log('ViewEditFile called for:', filePath);

        // Detect preview-able file types first
        try {
            const fileName      = filePath.split('/').pop();
            const fileExtension = (fileName.split('.').pop() || '').toLowerCase();
            const imageTypes   = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'];
            const videoTypes   = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'wmv', 'flv', 'mkv'];
            const audioTypes   = ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'];
            const pdfTypes     = ['pdf'];
            const officeTypes  = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];

            const previewable = [...imageTypes, ...videoTypes, ...audioTypes, ...pdfTypes, ...officeTypes];
            if (previewable.includes(fileExtension) && typeof window.showFilePreviewModal === 'function') {
                window.showFilePreviewModal(filePath, fileName, fileExtension, csrf, key, isEnc);
                dprogr();
                return; // Do not proceed to editor
            }
        } catch(e){
            console.warn('Preview detection failed:', e);
            // Continue to editor fallback
        }
        
        try {
            // Get file name from the path
            const fileName = filePath.split('/').pop();
            
            // Create a new tab specifically for editing with type 'editor'
            const newTabId = addNewTab(fileName, 'editor');
            console.log('Created new tab with ID:', newTabId);
            
            // Track this file as being opened
            if (window.saveOpenedFilesState) {
                window.saveOpenedFilesState(filePath, 'add');
            }
            
            // Wait for the tabs to render
            setTimeout(() => {
                // First, hide the file manager UI
                const fileManagerUI = document.getElementById('fileManagerUI');
                if (fileManagerUI) {
                    fileManagerUI.classList.add('hidden');
                    fileManagerUI.style.display = 'none'; // Add display:none to ensure it's hidden
                    console.log('fileManagerUI hidden');
                }
                
                // Make sure the tabs-content container exists
                    const tabsContentEl = document.getElementById('tabs-content');
                if (!tabsContentEl) {
                    console.error('Tabs content container not found');
                        dprogr();
                    triggerAlert('warning', 'Failed to initialize editor. Try refreshing the page.');
                    return;
                }
                
                // Check if tab content already exists
                let tabContent = document.getElementById(`${newTabId}-content`);
                
                // If not, create it
                if (!tabContent) {
                    console.log('Creating new tab content with ID:', `${newTabId}-content`);
                    tabContent = document.createElement('div');
                    tabContent.id = `${newTabId}-content`;
                    tabContent.className = 'tabs-panel w-full';
                    tabsContentEl.appendChild(tabContent);
                }
                
                // Make sure the tab content is visible and others are hidden
                document.querySelectorAll('.tabs-panel').forEach(panel => {
                    panel.classList.add('hidden');
                });
                
                // Hide all system tab panels too
                document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
                    panel.classList.add('hidden');
                });
                
                tabContent.classList.remove('hidden');
                
                // Continue with editor initialization
                continueWithTabContent(tabContent);
            }, 100);
            
            function continueWithTabContent(tabContent) {
                // Store file path for saving later
                tabContent.dataset.filePath = filePath;
                
                // Clear any existing content
                tabContent.innerHTML = '';
                
                // Create editor container
                const editorContainer = document.createElement('div');
                editorContainer.className = 'editor-container';
                editorContainer.style.width = '100%';
                editorContainer.style.height = '90vh';
                editorContainer.style.border = '1px solid #ddd';
                editorContainer.style.position = 'relative';
                tabContent.appendChild(editorContainer);
                
                // Add file type selector
                const typeSelector = document.createElement('div');
                typeSelector.className = 'file-type-selector fixed top-4 right-4 z-50';
                typeSelector.innerHTML = `
                    <select id="file-type-select-${newTabId}" class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm">
                        <option value="">Auto-detect</option>
                        <option value="javascript">JavaScript</option>
                        <option value="php">PHP</option>
                        <option value="htmlmixed">HTML</option>
                        <option value="css">CSS</option>
                        <option value="application/json">JSON</option>
                        <option value="xml">XML</option>
                        <option value="markdown">Markdown</option>
                        <option value="python">Python</option>
                        <option value="text/x-java">Java</option>
                        <option value="text/x-csrc">C</option>
                        <option value="text/x-c++src">C++</option>
                        <option value="sql">SQL</option>
                        <option value="shell">Shell/Bash</option>
                        <option value="yaml">YAML</option>
                        <option value="text">Plain Text</option>
                    </select>
                `;
                tabContent.appendChild(typeSelector);
                
        // Fetch file content from the server
        sendRequest({ csrf, action: 'view_content', file: filePath }, key, isEnc)
            .then(response => {
                        console.log('File content fetched successfully, length:', response.content?.length);
                        
                        if (typeof CodeMirror === 'undefined') {
                            console.error('CodeMirror is not defined!');
                            editorContainer.innerHTML = `<pre style="white-space: pre-wrap; padding: 1rem;">${response.content}</pre>`;
                            triggerAlert('warning', 'CodeMirror not found. Displaying content in plain text mode.');
                            dprogr();
                            return;
                        }
                        
                        // Get language based on file extension
                        const language = response.file_type || getLanguageFromFileName(filePath);
                        
                        // Create editor directly
                        const editor = CodeMirror(editorContainer, {
                            value: response.content || '',
                            mode: language,
                            theme: document.documentElement.classList.contains('dark') ? 'dracula' : 'eclipse',
                            lineNumbers: true,
                            lineWrapping: true,
                            matchBrackets: true,
                            autoCloseBrackets: true,
                            styleActiveLine: true
                        });
                        
                        // Store editor instance
                        window.editor = editor;
                        
                        // Make editor fill the container
                        editor.setSize('100%', '100%');
                        
                        // Set the file type selector to the current language
                        const typeSelect = document.getElementById(`file-type-select-${newTabId}`);
                        if (typeSelect) {
                            // Try to find the option that matches the current language
                            const options = Array.from(typeSelect.options);
                            const matchingOption = options.find(option => option.value === language);
                            if (matchingOption) {
                                typeSelect.value = language;
                            }
                            
                            // Add event listener to change the editor mode when the type is changed
                            typeSelect.addEventListener('change', () => {
                                const newMode = typeSelect.value || getLanguageFromFileName(filePath);
                                editor.setOption('mode', newMode);
                                // Reload the content with the new file type
                                sendRequest({ 
                                    csrf, 
                                    action: 'view_content', 
                                    file: filePath,
                                    file_type: newMode 
                                }, key, isEnc);
                                // Refresh editor to apply the new mode
                                setTimeout(() => editor.refresh(), 50);
                            });
                        }
                        
                        // Add a save button for this tab
                        let saveBtn = tabContent.querySelector('.save-file-btn');
                        if (!saveBtn) {
                            saveBtn = document.createElement('button');
                            saveBtn.className = 'save-file-btn fixed bottom-4 right-4 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded shadow-lg z-50';
                            saveBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Save';
                            saveBtn.addEventListener('click', () => {
                                const content = editor.getValue();
                                saveFileContent(filePath, content, csrf, key, isEnc);
                            });
                            tabContent.appendChild(saveBtn);
                        }
                        
                        // Focus the editor
                        setTimeout(() => {
                            if (editor) {
                                editor.refresh();
                                editor.focus();
                            }
                        }, 100);
                        
                        dprogr();
            })
            .catch(error => {
                        console.error('Error fetching file content:', error);
                        editorContainer.innerHTML = '<div class="p-4 text-red-500">Failed to load file content: ' + error + '</div>';
                        dprogr();
            });
            }
        } catch (error) {
            console.error('Error in viewEditFile:', error);
            dprogr();
        }
    }

    let editorInitialized = false;


    // Make the function available to the global scope for utils.js to access
    window.initializeEditor = function(content, language = 'plaintext', containerId = 'editorContainer') {
        progr();
        
        // Get container element
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Editor container not found:', containerId);
            dprogr();
            return;
        }
        
        // Get the theme based on current preference
        const theme = document.documentElement.classList.contains('dark') 
            ? 'dracula' 
            : 'eclipse';
        
        try {
            // Create new editor instance for this container
                // Define keyboard shortcuts for the editor
                const extraKeys = {
                    // Basic editing shortcuts
                    "Ctrl-S": function(cm) {
                    // Find the closest save button in the tab content
                    const tabContent = container.closest('[id$="-content"]');
                    if (tabContent) {
                        const saveBtn = tabContent.querySelector('.save-file-btn');
                        if (saveBtn) saveBtn.click();
                    } else {
                        const saveBtn = document.getElementById('saveFile');
                        if (saveBtn) saveBtn.click();
                    }
                        return false;
                    },
                    "Ctrl-F": "findPersistent",
                    "Ctrl-H": "replace",
                    // Indentation and comments
                    "Ctrl-/": "toggleComment",
                    "Tab": function(cm) {
                        if (cm.somethingSelected()) {
                            cm.indentSelection("add");
                        } else {
                            cm.replaceSelection("    ", "end");
                        }
                        return true;
                    },
                    "Shift-Tab": function(cm) {
                        cm.indentSelection("subtract");
                        return true;
                    },
                    // Code folding
                    "Ctrl-Q": function(cm) {
                        cm.foldCode(cm.getCursor());
                        return false;
                    },
                    // Misc
                    "Esc": function(cm) {
                        if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
                        return false;
                    }
                };
            
            // Clear container first
            container.innerHTML = '';
                
                // Create new editor with enhanced configuration
            const editor = CodeMirror(container, {
                    value: content || '',
                    mode: language,
                    theme: theme,
                    lineNumbers: true,
                    indentUnit: 4,
                    smartIndent: true,
                    indentWithTabs: false,
                    lineWrapping: true,
                    matchBrackets: true,
                    autoCloseBrackets: true,
                    autoCloseTags: true,
                    styleActiveLine: true,
                    selectionPointer: true,
                    tabSize: parseInt(localStorage.getItem('tab-size') || '4'),
                    extraKeys: extraKeys,
                    scrollbarStyle: 'native',
                    undoDepth: 200,
                    historyEventDelay: 200
                });
            
            // Store the editor instance
            window.editor = editor;
                
                // Make editor fill the container
            editor.setSize('100%', '100%');
                
                // Focus the editor after creation
                setTimeout(() => {
                if (editor) editor.focus();
                }, 100);
            
            // Refresh the editor to prevent layout issues
            setTimeout(() => {
                if (editor) editor.refresh();
            }, 50);
            
            console.log(`CodeMirror editor initialized with mode: ${language} in container: ${containerId}`);
        } catch (error) {
            console.error('Error initializing CodeMirror editor:', error);
            triggerAlert('warning', 'Failed to initialize the editor. Please try again.');
        } finally {
        dprogr();
        }
    }
    
    // Compatibility function for older code that might still use this
    window.createEditor = function(content, language) {
        console.log("createEditor called - redirecting to initializeEditor");
        
        // Check if initializeEditor exists first
        if (typeof window.initializeEditor !== 'function') {
            console.error("initializeEditor function not found");
            triggerAlert('warning', 'Editor initialization failed. Please refresh the page.');
            return;
        }
        
        // Ensure editor container exists
        if (!document.getElementById('editorContainer')) {
            console.error("Editor container not found");
            triggerAlert('warning', 'Editor container not found in DOM. Please refresh the page.');
            return;
        }
        
        // Call the new function with proper error handling
        try {
            window.initializeEditor(content, language);
        } catch (error) {
            console.error("Error in createEditor:", error);
            triggerAlert('warning', 'Failed to initialize editor. Please try again.');
        }
    }



   function showEdit(txt){

        document.getElementById('editorModal').classList.remove('hidden');
        window.initializeEditor(txt, "bash");

    }
 
    $(document).ready(function () {
        // Initialize fileManagerState as a global variable
        if (!window.fileManagerState) {
            window.fileManagerState = {
                files: [],
                totalPages: 1,
                currentPage: 1,
                currentSort: { column: 'name', direction: 'asc' },
                selectedFiles: [],
                tabs: [
                    { id: 'tab-1', path: currentDir, active: true, name: 'Home' }
                ],
                activeTabId: 'tab-1'
            };
        }
         
        // Get the items per page value
        const itemLimitElement = document.getElementById('itemLimit');
        let itemsPerPage = '50'; // Default value
        
        if (itemLimitElement && itemLimitElement.value) {
            itemsPerPage = itemLimitElement.value;
        } else {
            // Try to get value from localStorage
            const storedValue = localStorage.getItem('default-items-per-page');
            if (storedValue) {
                itemsPerPage = storedValue;
                // Update the dropdown if it exists
                if (itemLimitElement) {
                    itemLimitElement.value = itemsPerPage;
                }
            }
        }
        
        // Load the initial directory with the correct itemsPerPage value
        loadDirectory(currentDir, 1, csrf, key, isEnc, itemsPerPage);
        
        // Initialize sort icons
        function updateSortIcons() {
            const { column, direction } = window.fileManagerState.currentSort;
            $('th[data-sort]').find('i.fas').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
            const activeHeader = $(`th[data-sort="${column}"]`);
            if (activeHeader.length) {
                const icon = activeHeader.find('i.fas');
                icon.removeClass('fa-sort');
                icon.addClass(direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
            }
        }
        
        // Call the function to initialize sort icons
        setTimeout(updateSortIcons, 500); // Small delay to ensure DOM is ready
        
        // Function to handle keydown events
        function handleKeydown(e) {
            var keyCode = typeof e.which === "number" ? e.which : e.keyCode;

            /* Tab, Backspace and Delete key */
            if (keyCode === 8 || keyCode === 9 || keyCode === 46) {
                e.preventDefault();
                if (command !== '') {
                    if (keyCode === 8)
                        backSpace();
                    else if (keyCode === 46)
                        reverseBackSpace();
                    else if (keyCode === 9)
                        autoComplete();
                }
            }

            /* Ctrl + C */
            else if (e.ctrlKey && keyCode === 67) {
                autocomplete_position = 0;
                endLine();
                newLine();
                reset();
            }

            /* Enter */
            else if (keyCode === 13) {
                if (autocomplete_position !== 0) {
                    autocomplete_position = 0;
                    command = autocomplete_current_result;
                }

                if (command.toLowerCase().split(' ')[0] in commands)
                    commands[command.toLowerCase().split(' ')[0]](command.split(' ').slice(1));
                else if (command.length !== 0)
                    $.ajax({
                        type: 'POST',
                        async: false,
                        data: { command: command, path: path },
                        cache: false,
                        success: function (response) {
                            response = $.parseJSON(response);
                            path = response.path;
                            $('terminal content').append('<line><br>' + response.result + '</line>');
                        }
                    });

                endLine();
                addToHistory(command);
                newLine();
                reset();
                $('terminal content').scrollTop($('terminal content').prop("scrollHeight"));
            }

            /* Home, End, Left and Right (change blink position) */
            else if ((keyCode === 35 || keyCode === 36 || keyCode === 37 || keyCode === 39) && command !== '') {
                e.preventDefault();
                $('line.current bl').remove();

                if (autocomplete_position !== 0) {
                    autocomplete_position = 0;
                    command = autocomplete_current_result;
                }

                if (keyCode === 35)
                    blink_position = 0;

                if (keyCode === 36)
                    blink_position = command.length * -1;

                if (keyCode === 37 && command.length !== Math.abs(blink_position))
                    blink_position--;

                if (keyCode === 39 && blink_position !== 0)
                    blink_position++;

                printCommand();
                normalizeHtml();
            }

            /* Up and Down (suggest command from history)*/
            else if ((keyCode === 38 || keyCode === 40) && (command === '' || suggest)) {
                e.preventDefault();
                if (keyCode === 38
                    && command_history.length
                    && command_history.length >= history_index * -1 + 1) {

                    history_index--;
                    command = command_history[command_history.length + history_index];
                    printCommand();
                    normalizeHtml();
                    suggest = true;
                }
                else if (keyCode === 40
                    && command_history.length
                    && command_history.length >= history_index * -1
                    && history_index !== 0) {

                    history_index++;
                    command = (history_index === 0) ? '' : command_history[command_history.length + history_index];
                    printCommand();
                    normalizeHtml();
                    suggest = (history_index === 0) ? false : true;
                }
            }

            /* type characters */
            else if (keyCode === 32
                || keyCode === 222
                || keyCode === 220
                || (
                    (keyCode >= 45 && keyCode <= 195)
                    && !(keyCode >= 112 && keyCode <= 123)
                    && keyCode != 46
                    && keyCode != 91
                    && keyCode != 93
                    && keyCode != 144
                    && keyCode != 145
                    && keyCode != 45
                )
            ) {
                type(e.key);
                $('terminal content').scrollTop($('terminal content').prop("scrollHeight"));
            }
        }

        // Function to attach/detach keydown event listener based on terminal visibility
        function localUpdateKeydownListener() {
            // Always detach first to prevent duplicate handlers
            $(document).off('keydown', handleKeydown);
            
            if ($('#terminal').is(':visible')) {
                // If terminal is visible, attach keydown event listener
                $(document).on('keydown', handleKeydown);
                console.log('Terminal keydown listener attached');
            } else {
                console.log('Terminal keydown listener removed');
            }
        }

        // Initial check for visibility
        localUpdateKeydownListener();
        
        // Expose the function to the global scope for tabs to use
        window.updateKeydownListener = localUpdateKeydownListener;

        // Handle tab changes - use one-time handler to prevent multiple bindings
        $('[data-tabs-target]').off('click.terminal').on('click.terminal', function () {
            // Wait for the tab content to be visible
            setTimeout(() => {
                if (window.updateKeydownListener) {
                    window.updateKeydownListener();
                }
            }, 100);
        });
    });

    // Function to toggle visibility of location tabs and breadcrumbs
    function toggleNavigationElements() {
        const activeTabId = document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-tabs-target');
        const locationTabsContainer = document.querySelector('.mb-4.border-b.border-gray-200.dark\\:border-gray-700');
        const breadcrumbs = document.getElementById('breadcrumbs');
        
         
        if (activeTabId && locationTabsContainer && breadcrumbs) {
            // Hide for terminal, config, and setting tabs
            if (activeTabId === '#terminal' || activeTabId === '#config' || activeTabId === '#setting') {
                 locationTabsContainer.classList.add('hidden');
                breadcrumbs.classList.add('hidden');
            } else {
                 locationTabsContainer.classList.remove('hidden');
                breadcrumbs.classList.remove('hidden');
            }
        } else {
            console.warn('Could not find all required elements for navigation toggle');
        }
    }

    // Add event listener for tab changes to toggle navigation elements
    document.addEventListener('DOMContentLoaded', function() {
        // Initial check on page load
        toggleNavigationElements();
        
        // Listen for tab changes
        document.querySelectorAll('[data-tabs-target]').forEach(tab => {
            tab.addEventListener('click', function() {
                // Small delay to ensure the aria-selected attribute has been updated
                setTimeout(toggleNavigationElements, 50);
            });
        });
        
        // Use MutationObserver to detect tab changes
        const tabObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'aria-selected') {
                    toggleNavigationElements();
                }
            });
        });
        
        // Observe all tab buttons for aria-selected changes
        document.querySelectorAll('[role="tab"]').forEach(tab => {
            tabObserver.observe(tab, { attributes: true, attributeFilter: ['aria-selected'] });
        });
    });

    // Call toggleNavigationElements directly to ensure it runs
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', toggleNavigationElements);
    } else {
        // DOM already loaded, call immediately
        toggleNavigationElements();
    }

    function reset() {
        command = '';
        history_index = 0;
        blink_position = 0;
        autocomplete_position = 0;
        autocomplete_current_result = '';
        suggest = false;
    }
    function endLine() {
        $('line.current bl').remove();
        $('line.current').removeClass('current');
    }
    function newLine() {
        $('terminal content').append('<line class="current"><path>' + path + '</path> <sp></sp> <t><bl></bl></t></line>');
    }
    function addToHistory(command) {
        if (command.length >= 2 && (command_history.length === 0 || command_history[command_history.length - 1] !== command))
            command_history[command_history.length] = command;
    }
    function normalizeHtml() {
        let res = $('line.current t').html();
        let nres = res.split(' ').length == 1 ? '<cm>' + res + '</cm>' : '<cm>' + res.split(' ')[0] + '</cm> <code>' + res.split(' ').slice(1).join(' ').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>';

        $('line.current t').html(nres.replace('&lt;bl&gt;&lt;/bl&gt;', '<bl></bl>'));
    }
    function printCommand(cmd = '') {
        if (cmd === '')
            cmd = command;
        else
            blink_position = 0;

        let part1 = cmd.substr(0, cmd.length + blink_position);
        let part2 = cmd.substr(cmd.length + blink_position);

        $('line.current t').html(part1 + '<bl></bl>' + part2);
    }
    function type(t) {
        // Prevent event duplication by using a simple debounce approach
        // This timestamp helps ensure we don't register keystrokes too quickly
        const now = Date.now();
        if (window.lastTypeTimestamp && now - window.lastTypeTimestamp < 10) {
            // Ignore events that come too quickly (less than 10ms apart)
            return;
        }
        window.lastTypeTimestamp = now;
        
        history_index = 0;
        suggest = false;

        if (autocomplete_position !== 0) {
            autocomplete_position = 0;
            command = autocomplete_current_result;
        }
        if (command[command.length - 1] === '/' && t === '/')
            return;

        let part1 = command.substr(0, command.length + blink_position);
        let part2 = command.substr(command.length + blink_position);
        command = part1 + t + part2;

        printCommand();
        normalizeHtml();
    }
    function backSpace() {
        if (autocomplete_position !== 0) {
            autocomplete_position = 0;
            command = autocomplete_current_result;
        }

        let part1 = command.substr(0, command.length + blink_position);
        let part2 = command.substr(command.length + blink_position);
        command = part1.substr(0, part1.length - 1) + part2;

        printCommand();
        normalizeHtml();
    }
    function reverseBackSpace() {
        let part1 = command.substr(0, command.length + blink_position);
        let part2 = command.substr(command.length + blink_position);
        command = part1 + part2.substr(1);

        if (blink_position !== 0)
            blink_position++;

        printCommand();
        normalizeHtml();
    }
    function autoComplete() {
        if (autocomplete_search_for !== command) {
            autocomplete_search_for = command;
            autocomplete_temp_results = [];

            if (command.split(' ').length === 1) {
                let cmdlist = commands_list.concat(Object.keys(commands));
                autocomplete_temp_results = cmdlist
                    .filter(function (cm) { return (cm.length > command.length && cm.substr(0, command.length).toLowerCase() == command.toLowerCase()) ? true : false; })
                    .reverse().sort(function (a, b) { return b.length - a.length; });
            }

            else if (command.split(' ').length === 2) {
                let cmd = command.split(' ')[0];
                let cmd_parameter = command.split(' ')[1];
                var temp_cmd = '';

                if (cmd === 'cd' || cmd === 'cp' || cmd === 'mv' || cmd === 'cat') {
                    switch (cmd) {
                        case "cd": temp_cmd = 'ls -d ' + cmd_parameter + '*/'; break;
                        case "cp": case "mv": temp_cmd = 'ls -d ' + cmd_parameter + '*/'; break;
                        case "cat": temp_cmd = 'ls -p | grep -v /'; break;
                        default: temp_cmd = '';
                    }

                    $.ajax({
                        type: 'POST',
                        async: false,
                        data: { command: temp_cmd, path: path },
                        cache: false,
                        success: function (response) {
                            response = $.parseJSON(response);
                            autocomplete_temp_results = response.result.split('<br>')
                                .filter(function (cm) { return (cm.length !== 0) ? true : false; });
                        }
                    });
                }
            }
        }

        if (autocomplete_temp_results.length && autocomplete_temp_results.length > Math.abs(autocomplete_position)) {
            autocomplete_position--;
            autocomplete_current_result = ((command.split(' ').length === 2) ? command.split(' ')[0] + ' ' : '') + autocomplete_temp_results[autocomplete_temp_results.length + autocomplete_position];
            printCommand(autocomplete_current_result);
            normalizeHtml();
        }
        else {
            autocomplete_position = 0;
            autocomplete_current_result = '';
            printCommand();
            normalizeHtml();
        }
    }

    var commands = {
        'clear': clear,
        'history': history
    };

    function clear() {
        $('terminal content').html('');
    }

    function history(arg) {
        var res = [];
        let start_from = arg.length ? Number.isInteger(Number(arg[0])) ? Number(arg[0]) : 0 : 0;

        if (start_from != 0 && start_from <= command_history.length)
            for (var i = command_history.length - start_from; i < command_history.length; i++) { res[res.length] = (i + 1) + ' &nbsp;' + command_history[i]; }
        else
            command_history.forEach(function (item, index) { res[res.length] = (index + 1) + ' &nbsp;' + item; });

        $('terminal content').append('<line>' + res.join('<br>') + '</line>');
    }

    updateCurrentPath();





    document.getElementById("itemLimit").addEventListener("change", (e) => {
        const limit = e.target.value;
        console.log('Items per page changed to:', limit);

        // Save the setting to localStorage for persistence
        localStorage.setItem('default-items-per-page', limit);

        // Reset to page 1 when changing items per page
        window.fileManagerState.currentPage = 1;
        
        // Call loadDirectory with the correct itemsPerPage parameter
        loadDirectory(currentDir, 1, csrf, key, isEnc, limit);
    });


    function excute(code, csrf, currentDir, key, isEnc) {
        // Check if dark mode is enabled
        const isDarkMode = document.documentElement.classList.contains('dark');
        
        // Call the SweetAlert2 dialog with enhanced dark mode support
        Swal.fire({
            title: 'Execute PHP Code',
            html: `
                <div class="flex flex-col w-full">
                    <label for="php-code-input" class="text-left mb-2 text-gray-700 dark:text-gray-300 text-sm font-medium">Enter the PHP code to execute:</label>
                    <textarea id="php-code-input" rows="8" class="w-full p-3 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50 font-mono text-sm"></textarea>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Execute',
            cancelButtonText: 'Cancel',
            customClass: {
                popup: 'dark:bg-gray-800 dark:text-gray-200',
                title: 'text-gray-800 dark:text-gray-200',
                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
                cancelButton: 'bg-gray-500 hover:bg-gray-600 text-white'
            },
            background: isDarkMode ? '#1F2937' : '#FFFFFF',
            focusConfirm: false,
            preConfirm: () => {
                const phpCode = document.getElementById('php-code-input').value;
                if (!phpCode || phpCode.trim() === '') {
                    Swal.showValidationMessage('Please enter PHP code to execute');
                    return false;
                }
                return phpCode;
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                const phpCode = result.value;
                // Send the PHP code to the backend for execution
                sendRequest({ 
                    csrf, 
                    action: 'execute', 
                    code: phpCode.trim(), 
                    dir: currentDir 
                }, key, isEnc)
                    .then(response => {
                        // Display the result of the PHP execution in a new dialog with improved dark mode
                        Swal.fire({
                            title: 'PHP Execution Result',
                            html: `<div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                                    <pre class="text-left overflow-auto max-h-96 text-gray-800 dark:text-gray-200 font-mono text-sm bg-gray-100 dark:bg-gray-700 p-4 rounded">${response.output}</pre>
                                  </div>`,
                            icon: 'info',
                            confirmButtonText: 'Close',
                            customClass: {
                                popup: 'dark:bg-gray-800 dark:text-gray-200',
                                title: 'text-gray-800 dark:text-gray-200',
                                confirmButton: 'bg-blue-600 hover:bg-blue-700 text-white',
                                htmlContainer: 'p-0'
                            },
                            background: isDarkMode ? '#1F2937' : '#FFFFFF',
                            iconColor: isDarkMode ? '#3B82F6' : '#3B82F6'
                        });
                    })
                    .catch(error => {
                        triggerAlert('warning', error); // Show error message
                        console.error('Error executing PHP code:', error); // Log error for debugging
                    });
            }
        });
    }
      // Event delegation for rename button
  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('codeme')) {
        // const oldName = event.target.dataset.file;
        excute("oldName", csrf, currentDir, key, isEnc);
    }
});
 
});

// Function to initialize theme toggle
function initThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    // Check for saved theme preference or use system preference
    if (localStorage.getItem('color-theme') === 'dark' || 
        (!localStorage.getItem('color-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    // Add click event to toggle button
    themeToggleBtn.addEventListener('click', function() {
        // Toggle dark class on html element
        document.documentElement.classList.toggle('dark');
        
        // Update localStorage
        if (document.documentElement.classList.contains('dark')) {
            localStorage.setItem('color-theme', 'dark');
        } else {
            localStorage.setItem('color-theme', 'light');
        }
        
        // If editor is initialized, update its theme
        if (window.editor) {
            window.editor.updateOptions({
                theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs'
            });
        }
    });
}

// Function to initialize enhanced tabs with vanilla JavaScript
function initEnhancedTabs() {
    console.log('Initializing vanilla JS tabs');
    
    // Get all tab buttons and content elements
    const tabButtons = document.querySelectorAll('#default-tab button[role="tab"]');
    const tabContents = document.querySelectorAll('#default-tab-content > div[role="tabpanel"]');
        
    if (tabButtons.length === 0 || tabContents.length === 0) {
        console.error('No tab elements found');
        return;
    }
    
    // Initialize tabs
    function initTabs() {
        // Set default active tab
        let activeTabId = 'file-tab';
        const savedActiveTab = localStorage.getItem('activeTab');
        if (savedActiveTab && document.getElementById(savedActiveTab)) {
            activeTabId = savedActiveTab;
        }
        
        // Add click event listeners to all tab buttons
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.id;
                activateTab(tabId);
            });
        });
        
        // Activate the default tab
        activateTab(activeTabId);
    }
    
    // Function to activate a specific tab
    function activateTab(tabId) {
        // Get the button and target element
        const button = document.getElementById(tabId);
        if (!button) {
            console.warn(`Tab button ${tabId} not found`);
        return;
    }
    
        const target = button.getAttribute('data-tabs-target')?.substring(1);
        if (!target) {
            console.warn(`Tab target for ${tabId} not found`);
            return;
        }
        
        // Save active tab to localStorage
        localStorage.setItem('activeTab', tabId);
                        
                        // Hide all tab contents
                        tabContents.forEach(content => {
                            content.classList.add('hidden');
                            content.classList.remove('animate-fadeIn');
                        });
                        
        // Deactivate all tab buttons
                        tabButtons.forEach(btn => {
            btn.setAttribute('aria-selected', 'false');
                            btn.classList.remove('text-blue-600', 'border-blue-600');
                            btn.classList.add('border-transparent');
                        });
                        
        // Activate the selected tab
        button.setAttribute('aria-selected', 'true');
                        button.classList.add('text-blue-600', 'border-blue-600');
                        button.classList.remove('border-transparent');
        
        // Show the active tab content
        const activeContent = document.getElementById(target);
        if (activeContent) {
            activeContent.classList.remove('hidden');
            activeContent.classList.add('animate-fadeIn');
        }
                        
                        // Update navigation elements visibility
        updateNavigationVisibility(target);
        
        // Call our existing tab switch handler if available
        if (typeof handleTabSwitch === 'function') {
            handleTabSwitch('#' + target);
        }
        
        console.log(`Tab activated: ${tabId} -> #${target}`);
    }
    
    // Helper function to update navigation visibility based on active tab
    function updateNavigationVisibility(tabId) {
                        const locationTabsContainer = document.querySelector('.mb-4.border-b.border-gray-200.dark\\:border-gray-700');
                        const breadcrumbs = document.getElementById('breadcrumbs');
                        
                        if (locationTabsContainer && breadcrumbs) {
            if (tabId === 'terminal' || tabId === 'config' || tabId === 'setting') {
                                locationTabsContainer.classList.add('hidden');
                                breadcrumbs.classList.add('hidden');
                            } else {
                                locationTabsContainer.classList.remove('hidden');
                                breadcrumbs.classList.remove('hidden');
                            }
                        }
                    }
    
    // Initialize tabs
    try {
        initTabs();
    } catch (error) {
        console.error('Error initializing tabs:', error);
    
        // Fallback to basic tab initialization
        const firstTabButton = tabButtons[0];
        if (firstTabButton) {
            const firstTabTarget = firstTabButton.getAttribute('data-tabs-target');
            const firstTabContent = document.querySelector(firstTabTarget);
            
            if (firstTabContent) {
                // Hide all tab contents
                tabContents.forEach(content => {
                    content.classList.add('hidden');
                });
                
                // Show first tab
                firstTabContent.classList.remove('hidden');
                
                // Set first tab as active
                firstTabButton.setAttribute('aria-selected', 'true');
                firstTabButton.classList.add('text-blue-600', 'border-blue-600');
                firstTabButton.classList.remove('border-transparent');
                }
            }
        }
}

// Settings functionality
function initSettings() {
    // Load settings from localStorage
    loadSettings();
    
    // Theme buttons
    document.getElementById('light-theme-btn')?.addEventListener('click', () => {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('color-theme', 'light');
        updateEditorTheme('vs');
    });
    
    document.getElementById('dark-theme-btn')?.addEventListener('click', () => {
        document.documentElement.classList.add('dark');
        localStorage.setItem('color-theme', 'dark');
        updateEditorTheme('vs-dark');
    });
    
    document.getElementById('system-theme-btn')?.addEventListener('click', () => {
        localStorage.removeItem('color-theme');
        // Use system preference
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
            updateEditorTheme('vs-dark');
        } else {
            document.documentElement.classList.remove('dark');
            updateEditorTheme('vs');
        }
    });
    
    // Font size slider
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            const fontSize = e.target.value;
            document.documentElement.style.fontSize = fontSize + 'px';
            localStorage.setItem('font-size', fontSize);
        });
    }
    
    // Terminal font size slider
    const terminalFontSizeSlider = document.getElementById('terminal-font-size');
    if (terminalFontSizeSlider) {
        terminalFontSizeSlider.addEventListener('input', (e) => {
            const fontSize = e.target.value;
            const terminalContent = document.querySelector('terminal content');
            if (terminalContent) {
                terminalContent.style.fontSize = fontSize + 'px';
            }
            localStorage.setItem('terminal-font-size', fontSize);
        });
    }
    
    // UI Animation toggle
    const enableAnimations = document.getElementById('enable-animations');
    if (enableAnimations) {
        enableAnimations.addEventListener('change', (e) => {
            document.body.classList.toggle('disable-animations', !e.target.checked);
            localStorage.setItem('enable-animations', e.target.checked);
        });
    }

    // File Manager Settings
    const showHiddenFiles = document.getElementById('show-hidden');
    if (showHiddenFiles) {
        showHiddenFiles.addEventListener('change', (e) => {
            localStorage.setItem('show-hidden-files', e.target.checked);
            // Reload current directory to apply changes
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    const showFileSize = document.getElementById('show-file-size');
    if (showFileSize) {
        showFileSize.addEventListener('change', (e) => {
            localStorage.setItem('show-file-size', e.target.checked);
            // Reload current directory to apply changes
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    const showFileDate = document.getElementById('show-file-date');
    if (showFileDate) {
        showFileDate.addEventListener('change', (e) => {
            localStorage.setItem('show-file-date', e.target.checked);
            // Reload current directory to apply changes
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    const defaultSort = document.getElementById('default-sort');
    if (defaultSort) {
        defaultSort.addEventListener('change', (e) => {
            localStorage.setItem('default-sort', e.target.value);
            // Reload current directory to apply changes
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    // Terminal Settings
    const terminalWrap = document.getElementById('terminal-wrap');
    if (terminalWrap) {
        terminalWrap.addEventListener('change', (e) => {
            localStorage.setItem('terminal-wrap', e.target.checked);
            // Apply terminal wrap setting
            if (window.terminal) {
                window.terminal.setOption('wrap', e.target.checked);
            }
        });
    }

    const terminalBell = document.getElementById('terminal-bell');
    if (terminalBell) {
        terminalBell.addEventListener('change', (e) => {
            localStorage.setItem('terminal-bell', e.target.checked);
            // Apply terminal bell setting
            if (window.terminal) {
                window.terminal.setOption('bellStyle', e.target.checked ? 'sound' : 'none');
            }
        });
    }

    const terminalTheme = document.getElementById('terminal-theme');
    if (terminalTheme) {
        terminalTheme.addEventListener('change', (e) => {
            localStorage.setItem('terminal-theme', e.target.value);
            // Apply terminal theme
            if (window.terminal) {
                window.terminal.setOption('theme', e.target.value);
            }
        });
    }

    // Editor Settings
    const editorThemeSelect = document.getElementById('editor-theme');
    if (editorThemeSelect) {
        editorThemeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            if (theme === 'system') {
                // Use system preference
                updateEditorTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs');
                localStorage.setItem('editor-theme', 'system');
            } else {
                updateEditorTheme(theme);
                localStorage.setItem('editor-theme', theme);
            }
        });
    }
    
    // Tab size select
    const tabSizeSelect = document.getElementById('tab-size');
    if (tabSizeSelect) {
        tabSizeSelect.addEventListener('change', (e) => {
            const tabSize = e.target.value;
            if (window.editor) {
                window.editor.setOption('tabSize', parseInt(tabSize));
            }
            localStorage.setItem('tab-size', tabSize);
        });
    }
    
    // Editor options
    const wordWrapCheckbox = document.getElementById('word-wrap');
    if (wordWrapCheckbox) {
        wordWrapCheckbox.addEventListener('change', (e) => {
            if (window.editor) {
                window.editor.setOption('lineWrapping', e.target.checked);
            }
            localStorage.setItem('word-wrap', e.target.checked);
        });
    }

    const autoCloseBrackets = document.getElementById('auto-close-brackets');
    if (autoCloseBrackets) {
        autoCloseBrackets.addEventListener('change', (e) => {
            if (window.editor) {
                window.editor.setOption('autoCloseBrackets', e.target.checked);
            }
            localStorage.setItem('auto-close-brackets', e.target.checked);
        });
    }

    const highlightActiveLine = document.getElementById('highlight-active-line');
    if (highlightActiveLine) {
        highlightActiveLine.addEventListener('change', (e) => {
            if (window.editor) {
                window.editor.setOption('styleActiveLine', e.target.checked);
            }
            localStorage.setItem('highlight-active-line', e.target.checked);
        });
    }
    
    // Default items per page select
    const defaultItemsSelect = document.getElementById('default-items');
    if (defaultItemsSelect) {
        defaultItemsSelect.addEventListener('change', (e) => {
            const itemsPerPage = e.target.value;
            localStorage.setItem('default-items-per-page', itemsPerPage);
            
            // Update the current itemLimit dropdown
            const itemLimitElement = document.getElementById('itemLimit');
            if (itemLimitElement) {
                itemLimitElement.value = itemsPerPage;
                // Trigger change to refresh the view
                const event = new Event('change');
                itemLimitElement.dispatchEvent(event);
            }
        });
    }
    
    // Save settings button
    document.getElementById('save-settings')?.addEventListener('click', () => {
        saveSettings();
        triggerAlert('success', 'Settings saved successfully!');
    });
}

// Load settings from localStorage
function loadSettings() {
    // Font size
    const fontSize = localStorage.getItem('font-size') || '14';
    document.documentElement.style.fontSize = fontSize + 'px';
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) fontSizeSlider.value = fontSize;
    
    // Terminal font size
    const terminalFontSize = localStorage.getItem('terminal-font-size') || '14';
    const terminalContent = document.querySelector('terminal content');
    if (terminalContent) terminalContent.style.fontSize = terminalFontSize + 'px';
    const terminalFontSizeSlider = document.getElementById('terminal-font-size');
    if (terminalFontSizeSlider) terminalFontSizeSlider.value = terminalFontSize;

    // UI Animations
    const enableAnimations = localStorage.getItem('enable-animations') !== 'false';
    document.body.classList.toggle('disable-animations', !enableAnimations);
    const animationsCheckbox = document.getElementById('enable-animations');
    if (animationsCheckbox) animationsCheckbox.checked = enableAnimations;

    // File Manager Settings
    const showHidden = localStorage.getItem('show-hidden-files') === 'true';
    const showHiddenCheckbox = document.getElementById('show-hidden');
    if (showHiddenCheckbox) showHiddenCheckbox.checked = showHidden;

    const showFileSize = localStorage.getItem('show-file-size') !== 'false';
    const showFileSizeCheckbox = document.getElementById('show-file-size');
    if (showFileSizeCheckbox) showFileSizeCheckbox.checked = showFileSize;

    const showFileDate = localStorage.getItem('show-file-date') !== 'false';
    const showFileDateCheckbox = document.getElementById('show-file-date');
    if (showFileDateCheckbox) showFileDateCheckbox.checked = showFileDate;

    const defaultSort = localStorage.getItem('default-sort') || 'date-desc';
    const defaultSortSelect = document.getElementById('default-sort');
    if (defaultSortSelect) defaultSortSelect.value = defaultSort;

    // Terminal Settings
    const terminalWrap = localStorage.getItem('terminal-wrap') !== 'false';
    const terminalWrapCheckbox = document.getElementById('terminal-wrap');
    if (terminalWrapCheckbox) terminalWrapCheckbox.checked = terminalWrap;

    const terminalBell = localStorage.getItem('terminal-bell') === 'true';
    const terminalBellCheckbox = document.getElementById('terminal-bell');
    if (terminalBellCheckbox) terminalBellCheckbox.checked = terminalBell;

    const terminalTheme = localStorage.getItem('terminal-theme') || 'default';
    const terminalThemeSelect = document.getElementById('terminal-theme');
    if (terminalThemeSelect) terminalThemeSelect.value = terminalTheme;
    
    // Editor theme
    const editorTheme = localStorage.getItem('editor-theme') || 'system';
    const editorThemeSelect = document.getElementById('editor-theme');
    if (editorThemeSelect) editorThemeSelect.value = editorTheme;
    
    // Tab size
    const tabSize = localStorage.getItem('tab-size') || '4';
    const tabSizeSelect = document.getElementById('tab-size');
    if (tabSizeSelect) tabSizeSelect.value = tabSize;
    
    // Editor options
    const wordWrap = localStorage.getItem('word-wrap') !== 'false';
    const wordWrapCheckbox = document.getElementById('word-wrap');
    if (wordWrapCheckbox) wordWrapCheckbox.checked = wordWrap;

    const autoCloseBrackets = localStorage.getItem('auto-close-brackets') !== 'false';
    const autoCloseBracketsCheckbox = document.getElementById('auto-close-brackets');
    if (autoCloseBracketsCheckbox) autoCloseBracketsCheckbox.checked = autoCloseBrackets;

    const highlightActiveLine = localStorage.getItem('highlight-active-line') !== 'false';
    const highlightActiveLineCheckbox = document.getElementById('highlight-active-line');
    if (highlightActiveLineCheckbox) highlightActiveLineCheckbox.checked = highlightActiveLine;
    
    // Default items per page
    const defaultItems = localStorage.getItem('default-items-per-page') || '50';
    const defaultItemsSelect = document.getElementById('default-items');
    if (defaultItemsSelect) defaultItemsSelect.value = defaultItems;
    
    // Apply items per page to current view
    const itemLimitElement = document.getElementById('itemLimit');
    if (itemLimitElement && defaultItems) {
        itemLimitElement.value = defaultItems;
    }
}

// Save all settings to localStorage
function saveSettings() {
    // Font size
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) localStorage.setItem('font-size', fontSizeSlider.value);
    
    // Terminal font size
    const terminalFontSizeSlider = document.getElementById('terminal-font-size');
    if (terminalFontSizeSlider) localStorage.setItem('terminal-font-size', terminalFontSizeSlider.value);

    // UI Animations
    const enableAnimations = document.getElementById('enable-animations');
    if (enableAnimations) localStorage.setItem('enable-animations', enableAnimations.checked);

    // File Manager Settings
    const showHidden = document.getElementById('show-hidden');
    if (showHidden) localStorage.setItem('show-hidden-files', showHidden.checked);

    const showFileSize = document.getElementById('show-file-size');
    if (showFileSize) localStorage.setItem('show-file-size', showFileSize.checked);

    const showFileDate = document.getElementById('show-file-date');
    if (showFileDate) localStorage.setItem('show-file-date', showFileDate.checked);

    const defaultSort = document.getElementById('default-sort');
    if (defaultSort) localStorage.setItem('default-sort', defaultSort.value);

    // Terminal Settings
    const terminalWrap = document.getElementById('terminal-wrap');
    if (terminalWrap) localStorage.setItem('terminal-wrap', terminalWrap.checked);

    const terminalBell = document.getElementById('terminal-bell');
    if (terminalBell) localStorage.setItem('terminal-bell', terminalBell.checked);

    const terminalTheme = document.getElementById('terminal-theme');
    if (terminalTheme) localStorage.setItem('terminal-theme', terminalTheme.value);
    
    // Editor theme
    const editorThemeSelect = document.getElementById('editor-theme');
    if (editorThemeSelect) localStorage.setItem('editor-theme', editorThemeSelect.value);
    
    // Tab size
    const tabSizeSelect = document.getElementById('tab-size');
    if (tabSizeSelect) localStorage.setItem('tab-size', tabSizeSelect.value);
    
    // Editor options
    const wordWrapCheckbox = document.getElementById('word-wrap');
    if (wordWrapCheckbox) localStorage.setItem('word-wrap', wordWrapCheckbox.checked);

    const autoCloseBrackets = document.getElementById('auto-close-brackets');
    if (autoCloseBrackets) localStorage.setItem('auto-close-brackets', autoCloseBrackets.checked);

    const highlightActiveLine = document.getElementById('highlight-active-line');
    if (highlightActiveLine) localStorage.setItem('highlight-active-line', highlightActiveLine.checked);
    
    // Default items per page
    const defaultItemsSelect = document.getElementById('default-items');
    if (defaultItemsSelect) localStorage.setItem('default-items-per-page', defaultItemsSelect.value);
}

// Update editor theme
function updateEditorTheme(theme) {
    // Store theme preference globally
    window.editorThemePreference = theme;
    
    // Map Monaco themes to CodeMirror themes
    // Monaco: 'vs' (light), 'vs-dark' (dark), or 'system'
    let codeMirrorTheme = 'eclipse'; // default light theme
    
    if (theme === 'vs-dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        codeMirrorTheme = 'dracula'; // dark theme
    }
    
    // Apply theme to CodeMirror editor if it's available
    if (window.editor && typeof window.editor.setOption === 'function') {
        try {
            window.editor.setOption('theme', codeMirrorTheme);
            
            // Update theme-related UI elements
            const editorContainer = document.getElementById('editorContainer');
            if (editorContainer) {
                if (codeMirrorTheme === 'dracula') {
                    editorContainer.classList.add('dark-editor');
                    editorContainer.classList.remove('light-editor');
                } else {
                    editorContainer.classList.add('light-editor');
                    editorContainer.classList.remove('dark-editor');
                }
            }
            
            // Update bottom status bar if it exists
            const editorStatus = document.getElementById('editorStatus');
            if (editorStatus) {
                if (codeMirrorTheme === 'dracula') {
                    editorStatus.classList.add('dark-status');
                    editorStatus.classList.remove('light-status');
                } else {
                    editorStatus.classList.add('light-status');
                    editorStatus.classList.remove('dark-status');
                }
            }
            
            console.log('Editor theme updated to:', codeMirrorTheme);
        } catch (error) {
            console.error('Error updating editor theme:', error);
        }
    } else {
        console.log('CodeMirror editor not available, theme will be applied when editor loads');
    }
}

// Initialize the editor language selector dropdown
window.initEditorLanguageSelector = function() {
    const languageSelector = document.getElementById('editorLanguage');
    if (!languageSelector || languageSelector.dataset.initialized) return;
    
    // Add event listener to update editor mode on language change
    languageSelector.addEventListener('change', function() {
        const selectedMode = this.value;
        if (window.editor && selectedMode) {
            try {
                window.editor.setOption('mode', selectedMode);
                console.log('Editor mode changed to:', selectedMode);
                
                // Update status bar
                const statusEl = document.getElementById('editorStatus');
                if (statusEl) {
                    const currentText = statusEl.textContent || '';
                    // Replace just the language part
                    const updatedText = currentText.replace(/\|.*\|/, `| ${selectedMode} |`);
                    statusEl.textContent = updatedText;
                }
            } catch (error) {
                console.error('Error changing editor mode:', error);
            }
        }
    });
    
    languageSelector.dataset.initialized = 'true';
    console.log('Editor language selector initialized');
};

// Function to initialize global keyboard shortcuts
function initGlobalKeyboardShortcuts() {
    // Store shortcut help text for the help dialog
    const shortcutHelp = [
        { key: 'Delete', action: 'Delete selected files' },
        { key: 'Ctrl+A', action: 'Select all files' },
        { key: 'Ctrl+C', action: 'Copy selected files' },
        { key: 'Ctrl+X', action: 'Cut selected files' },
        { key: 'Ctrl+V', action: 'Paste files' },
        { key: 'Alt+F', action: 'Search files' },
        { key: 'F2', action: 'Rename selected file' },
        { key: 'F5', action: 'Refresh directory' },
        { key: 'Alt+Up', action: 'Navigate to parent directory' },
        { key: 'Escape', action: 'Deselect all files / Close dialogs' },
        { key: '?', action: 'Show this help dialog' }
    ];
    
    // Function to show the keyboard shortcuts help dialog
    function showKeyboardShortcutsHelp() {
        // Build the HTML for the shortcuts table
        let shortcutsHtml = '<div class="overflow-x-auto"><table class="w-full text-sm text-left">';
        shortcutsHtml += '<thead class="text-xs uppercase bg-gray-100 dark:bg-gray-700"><tr><th class="px-6 py-3">Key</th><th class="px-6 py-3">Action</th></tr></thead><tbody>';
        
        shortcutHelp.forEach(item => {
            shortcutsHtml += `<tr class="border-b dark:border-gray-700"><td class="px-6 py-4 font-medium">${item.key}</td><td class="px-6 py-4">${item.action}</td></tr>`;
        });
        
        shortcutsHtml += '</tbody></table></div>';
        
        // Show the shortcuts help dialog
        Swal.fire({
            title: 'Keyboard Shortcuts',
            html: shortcutsHtml,
            customClass: {
                popup: 'dark:bg-gray-800 dark:text-white'
            }
        });
    }
    
    // Add click event listener to the keyboard shortcuts button
    const keyboardShortcutsBtn = document.getElementById('keyboardShortcutsBtn');
    if (keyboardShortcutsBtn) {
        keyboardShortcutsBtn.addEventListener('click', showKeyboardShortcutsHelp);
    }
    
    // Create a global keyboard event listener
    document.addEventListener('keydown', function(e) {
        // Skip if we're in an input field, textarea, or editor is active
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'TEXTAREA' || 
            e.target.classList.contains('CodeMirror') ||
            document.querySelector('#terminal:not(.hidden)')) {
            return;
        }
        
        // Ensure fileManagerState exists and is initialized
        if (!window.fileManagerState) {
            console.error('fileManagerState is not initialized');
            return;
        }
        
        // Get current state
        const currentDir = window.fileManagerState?.currentDir || phpVars?.currentDir;
        const csrf = phpVars?.csrf;
        const key = phpVars?.encryptionKey ? CryptoJS.enc.Utf8.parse(phpVars.encryptionKey) : null;
        const isEnc = phpVars?.isEnc;
        
        // Ensure selectedFiles exists
        if (!window.fileManagerState.selectedFiles) {
            window.fileManagerState.selectedFiles = [];
        }
        
        // Get selected files
        const selectedFiles = window.fileManagerState.selectedFiles || [];
         
        // Handle various keyboard shortcuts
        switch (true) {
            // Delete - Delete selected files
            case e.key === 'Delete':
                console.log('Delete key pressed, selected files:', selectedFiles.length);
                if (selectedFiles.length > 0) {
                    e.preventDefault();
                    
                    // Make sure we're not in a text input field
                    if (document.activeElement.tagName === 'INPUT' || 
                        document.activeElement.tagName === 'TEXTAREA' || 
                        document.activeElement.isContentEditable) {
                        return; // Let the browser handle the delete in text fields
                    }
                    
                    // Create a copy of the array to prevent any issues
                    const filesToDelete = [...selectedFiles];
                    
                    window.showConfirmation(
                        'Delete Files',
                        `Are you sure you want to delete ${filesToDelete.length} file(s)?`,
                        'Delete',
                        () => {
                            console.log('Files to delete:', filesToDelete);
                            
                            // Use sendBulkActionRequest instead of performBulkAction for better reliability
                            if (typeof window.sendBulkActionRequest === 'function') {
                                window.sendBulkActionRequest({
                                    action: 'delete',
                                    files: filesToDelete,
                                    onSuccess: () => {
                                        // Clear selection after successful operation
                                        if (typeof window.clearFileSelection === 'function') {
                                            window.clearFileSelection();
                                        }
                                        
                                        window.triggerAlert('success', 'Files deleted successfully');
                                        window.loadDirectory(currentDir, 1, csrf, key, isEnc);
                                    }
                                });
                            } else {
                                // Fallback to old method
                                window.performBulkAction('delete', filesToDelete, currentDir, csrf, key, isEnc);
                            }
                        }
                    );
                }
                break;
            
          
            case e.ctrlKey && e.key === 'a':
                console.log('Alt+A pressed');
                e.preventDefault();
                const checkboxes = document.querySelectorAll('.file-checkbox');
                const selectAllCheckbox = document.getElementById('selectAll');
                
                // Check all checkboxes
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                    window.updateSelectedFiles(checkbox.dataset.file, true);
                });
                
                // Update "Select All" checkbox if it exists
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = true;
                }
                
                // Show success message
                window.triggerAlert('info', `Selected ${checkboxes.length} file(s)`);
                break;
            
             
            case e.ctrlKey && e.key === 'c':
                console.log('Alt+C pressed, selected files:', selectedFiles.length);
                if (selectedFiles.length > 0) {
                    e.preventDefault();
                    
                    // Convert filenames to full paths
                    const filesWithPaths = selectedFiles.map(file => {
                        if (!file.includes('/')) {
                            return `${currentDir}/${file}`;
                        }
                        return file;
                    });
                    
                    // Save to localStorage using our function
                    if (typeof window.saveToLocalStorage === 'function') {
                        window.saveToLocalStorage(filesWithPaths);
                        
                        // Remove any previous cut operation
                        localStorage.removeItem('clipboard-action');
                        
                        // Show success message
                        window.triggerAlert('success', `Copied ${selectedFiles.length} file(s) to clipboard`);
                    } else {
                        console.error('saveToLocalStorage function not found');
                        window.triggerAlert('warning', 'Copy operation failed');
                    }
                }
                break;
            
             
            case e.Ctrl && e.key === 'x':
                console.log('Alt+X pressed, selected files:', selectedFiles.length);
                if (selectedFiles.length > 0) {
                    e.preventDefault();
                    
                    // Convert filenames to full paths
                    const filesWithPaths = selectedFiles.map(file => {
                        if (!file.includes('/')) {
                            return `${currentDir}/${file}`;
                        }
                        return file;
                    });
                    
                    // Save to localStorage using our function
                    if (typeof window.saveToLocalStorage === 'function') {
                        window.saveToLocalStorage(filesWithPaths);
                        
                        // Mark as cut operation
                        localStorage.setItem('clipboard-action', 'cut');
                        
                        // Show success message
                        window.triggerAlert('info', `Cut ${selectedFiles.length} file(s) to clipboard`);
                    } else {
                        console.error('saveToLocalStorage function not found');
                        window.triggerAlert('warning', 'Cut operation failed');
                    }
                }
                break;
            
            
            case e.Ctrl && e.key === 'v':
                console.log('Alt+V pressed');
                e.preventDefault();
                
                // Get files from clipboard using our function
                if (typeof window.getFromLocalStorage === 'function') {
                    const files = window.getFromLocalStorage();
                    
                    if (files && files.length > 0) {
                        console.log('Pasting files:', files);
                        console.log('Current directory:', currentDir);
                        
                        // Show a loading indicator
                        window.triggerAlert('info', `Pasting ${files.length} item(s)...`);
                        
                        // Use sendBulkActionRequest instead of performBulkAction for better reliability
                        if (typeof window.sendBulkActionRequest === 'function') {
                            window.sendBulkActionRequest({
                                action: 'paste',
                                files: files,
                                onSuccess: () => {
                                    // Clear selection after successful operation
                                    if (typeof window.clearFileSelection === 'function') {
                                        window.clearFileSelection();
                                    }
                                    
                                    window.triggerAlert('success', 'Files pasted successfully');
                                    window.loadDirectory(currentDir, 1, csrf, key, isEnc);
                                    
                                    // Clear clipboard after paste if it was a cut operation
                                    if (localStorage.getItem('clipboard-action') === 'cut') {
                                        if (typeof window.freeclipbroad === 'function') {
                                            window.freeclipbroad();
                                        }
                                        localStorage.removeItem('clipboard-action');
                                    }
                                }
                            });
                        } else {
                            // Fallback to old method
                            window.performBulkAction('paste', files, currentDir, csrf, key, isEnc);
                            
                            // Clear clipboard after paste if it was a cut operation
                            if (localStorage.getItem('clipboard-action') === 'cut') {
                                if (typeof window.freeclipbroad === 'function') {
                                    window.freeclipbroad();
                                }
                                localStorage.removeItem('clipboard-action');
                            }
                        }
                    } else {
                        window.triggerAlert('warning', 'No items in clipboard');
                    }
                } else {
                    console.error('getFromLocalStorage function not found');
                    window.triggerAlert('warning', 'Paste operation failed');
                }
                break;
                
             case e.altKey && e.key === 'f':
                console.log('Alt+F pressed');
                e.preventDefault();
                
                // Open the advanced search
                if (typeof window.showAdvancedSearch === 'function') {
                    window.showAdvancedSearch();
                } else {
                    // Focus on search input if available
                    const searchInput = document.getElementById('searchInput');
                    if (searchInput) {
                        searchInput.focus();
                    } else {
                        window.triggerAlert('info', 'Search function not available');
                    }
                }
                break;
            
             case e.key === 'F2':
                console.log('F2 pressed, selected files:', selectedFiles.length);
                if (selectedFiles.length === 1) {
                    e.preventDefault();
                    window.renameFile(selectedFiles[0], csrf, currentDir, key, isEnc);
                } else if (selectedFiles.length > 1) {
                    window.triggerAlert('warning', 'Please select only one file to rename');
                }
                break;  
            
           
            case e.key === 'F5':
                console.log('F5 pressed');
                e.preventDefault();
                
                // Get current items per page setting
                let itemLimitElement = document.getElementById('itemLimit');
                let itemsPerPage = itemLimitElement ? itemLimitElement.value : '50';
                
                window.loadDirectory(currentDir, 1, csrf, key, isEnc, itemsPerPage);
                window.triggerAlert('info', 'Refreshing Files...');
                break;
            
            // Alt+Up - Navigate to parent directory
            case e.altKey && e.key === 'ArrowUp':
                console.log('Alt+Up pressed');
                e.preventDefault();
                
                // Access the current path from the global fileManagerState
                const currentPath = window.fileManagerState?.currentDir || phpVars?.currentDir || '/';
                
                // Get parent directory path
                const parts = currentPath.split('/').filter(part => part !== '');
                parts.pop(); // Remove the last part to get the parent directory
                const parentPath = parts.length > 0 ? '/' + parts.join('/') : '/';
                
                // Get current items per page setting
                const parentNavItemLimit = document.getElementById('itemLimit');
                const parentNavItemsPerPage = parentNavItemLimit ? parentNavItemLimit.value : '50';
                
                                // Load the parent directory and update UI
                window.loadDirectory(parentPath, 1, phpVars.csrf, 
                    phpVars.encryptionKey ? CryptoJS.enc.Utf8.parse(phpVars.encryptionKey) : null, 
                    phpVars.isEnc, parentNavItemsPerPage);
                
                
                // Update active tab path if that function exists
                if (typeof window.updateActiveTabPath === 'function') {
                    window.updateActiveTabPath(parentPath);
                }
                
                // Update file manager state if available
                if (window.fileManagerState) {
                    window.fileManagerState.currentDir = parentPath;
                }
                
                // Show a notification
                window.triggerAlert('info', 'Navigated to parent directory');
                break;
            
             case e.key === 'Escape':
                console.log('Escape pressed');
                // First check if any modal or dialog is open
                const visibleModal = document.querySelector('.modal:not(.hidden)');
                const visibleContextMenu = document.querySelector('#context-menu:not(.hidden)');
                
                if (visibleModal || visibleContextMenu) {
                    // Let the modal/context menu handle the escape key
                    return;
                }
                
                e.preventDefault();
                // Uncheck all checkboxes
                document.querySelectorAll('.file-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                // Update "Select All" checkbox if it exists
                const selectAllCheckboxEsc = document.getElementById('selectAll');
                if (selectAllCheckboxEsc) {
                    selectAllCheckboxEsc.checked = false;
                }
                
                // Clear selected files array
                window.fileManagerState.selectedFiles = [];
                
                // Show message
                window.triggerAlert('info', 'Deselected all files');
                break;
            
             case e.key === '?':
                console.log('? key pressed');
                e.preventDefault();
                showKeyboardShortcutsHelp();
                break;
        }
    });
    
 }

// Function to expose utility functions to global scope
function exposeUtilityFunctions() {
    // Expose necessary functions to the global scope for keyboard shortcuts
    window.updateSelectedFiles = typeof updateSelectedFiles === 'function' ? 
        updateSelectedFiles : function() { console.error('updateSelectedFiles not found'); };
        
    // Expose updateBreadcrumbs for global access
    window.updateBreadcrumbs = typeof updateBreadcrumbs === 'function' ? 
        updateBreadcrumbs : function(path) {  };
        
    // Add advanced search function to global scope
    window.showAdvancedSearch = function() {
        // Check if phpVars is available
        if (!window.phpVars) {
            console.error('phpVars not found');
            triggerAlert('danger', 'Required configuration is missing. Please refresh the page and try again.');
            return;
        }
        
        // Create a new tab for advanced search if it doesn't exist
        const tabName = 'Advanced Search';
        const tabId = addNewTab(tabName, 'search');
        
        // Switch to the tab
        switchToTab(tabId);
        
        // Get the tab content element
        const tabContent = document.getElementById(`${tabId}-content`);
        if (!tabContent) {
            console.error('Search tab content not found');
            return;
        }
        
        // Clear existing content
        tabContent.innerHTML = '';
        
        // Create search form
        const searchForm = document.createElement('div');
        searchForm.className = 'search-form bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-4';
        searchForm.innerHTML = `
            <h2 class="text-xl font-semibold mb-4 text-gray-800 dark:text-white">Advanced Search</h2>
            <form id="advanced-search-form" class="space-y-4" onsubmit="event.preventDefault(); performAdvancedSearch(); return false;">
                <!-- Search Mode Selector -->
                <div class="mb-6">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search Mode</label>
                    <div class="flex space-x-4">
                        <label class="inline-flex items-center">
                            <input type="radio" name="search-mode" value="text" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" checked onchange="toggleSearchMode('text')">
                            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Text Search</span>
                        </label>
                        <label class="inline-flex items-center">
                            <input type="radio" name="search-mode" value="permission" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300" onchange="toggleSearchMode('permission')">
                            <span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Permission Search</span>
                        </label>
                    </div>
                </div>

                <!-- Common Settings -->
                <div class="mb-4">
                    <div>
                        <label for="search-path" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Path</label>
                        <input type="text" id="search-path" name="search-path" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Directory path" value="${window.fileManagerState?.currentDir || '.'}">
                    </div>
                </div>

                <!-- Text Search Section -->
                <div id="text-search-section" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="search-query" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Search Query</label>
                            <input type="text" id="search-query" name="search-query" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Enter search text or pattern">
                        </div>
                    <div>
                        <label for="file-extensions" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File Extensions</label>
                        <input type="text" id="file-extensions" name="file-extensions" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g. php,js,html,css">
                    </div>
                    </div>

                    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Text Search Options</h3>
                        <div class="space-y-2">
                        <div class="flex items-center">
                            <input type="checkbox" id="case-sensitive" name="case-sensitive" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                            <label for="case-sensitive" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Case Sensitive</label>
                        </div>
                        <div class="flex items-center">
                            <input type="checkbox" id="use-regex" name="use-regex" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                            <label for="use-regex" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Use Regex</label>
                        </div>
                        </div>
                    </div>
                </div>

                <!-- Permission Search Section -->
                <div id="permission-search-section" class="space-y-4 hidden">
                    <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Permission Filters</h3>
                        <div class="space-y-2">
                        <div class="flex items-center">
                            <input type="checkbox" id="writable-only" name="writable-only" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                            <label for="writable-only" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Writable Files Only</label>
                        </div>
                            <div class="flex items-center">
                                <input type="checkbox" id="writable-folders" name="writable-folders" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="writable-folders" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Writable Folders Only</label>
                            </div>
                            <div class="flex items-center">
                                <input type="checkbox" id="executable-only" name="executable-only" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="executable-only" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Executable Files</label>
                            </div>
                            <div class="flex items-center">
                                <input type="checkbox" id="suid-binaries" name="suid-binaries" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="suid-binaries" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">SUID Binaries</label>
                            </div>
                            <div class="flex items-center">
                                <input type="checkbox" id="include-hidden" name="include-hidden" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                <label for="include-hidden" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Include Hidden Files/Folders</label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Common Options -->
                <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Search Settings</h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label for="max-results" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Results</label>
                            <input type="number" id="max-results" name="max-results" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value="1000" min="10" max="10000">
                        </div>
                        <div>
                            <label for="batch-size" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Batch Size</label>
                            <input type="number" id="batch-size" name="batch-size" class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" value="200" min="50" max="1000" title="Number of files to process per batch">
                        </div>
                        <div class="flex items-center pt-6">
                            <input type="checkbox" id="recursive-search" name="recursive-search" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" checked>
                            <label for="recursive-search" class="ml-2 block text-sm text-gray-700 dark:text-gray-300">Recursive Search</label>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end">
                    <button type="submit" class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <svg class="mr-2 -ml-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Search
                    </button>
                </div>
            </form>
        `;
        
        // Create results container
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'search-results-container';
        resultsContainer.className = 'search-results bg-white dark:bg-gray-800 p-4 rounded-lg shadow';
        resultsContainer.innerHTML = `
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-semibold text-gray-800 dark:text-white">Search Results</h2>
                <div id="search-stats" class="text-sm text-gray-500 dark:text-gray-400"></div>
            </div>
            <div id="search-results" class="space-y-4">
                <div class="text-gray-500 dark:text-gray-400 text-center py-8">Enter a search query and click Search</div>
            </div>
        `;
        
        // Append form and results to tab content
        tabContent.appendChild(searchForm);
        tabContent.appendChild(resultsContainer);
        
        // Add event listener to form submission
        const form = document.getElementById('advanced-search-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                performAdvancedSearch();
                return false;
            });
        }
    };
    
    // Function to validate search path before sending request
    function validateSearchPath(path) {
        // Check if path is empty
        if (!path || path.trim() === '') {
            return { valid: false, message: 'Search path cannot be empty' };
        }
        
        // We'll let the server handle path validation for security
        // Just provide a warning for absolute paths but still allow them
        if (path.startsWith('/')) {
            console.warn("Using absolute path for search: " + path);
        }
        
        return { valid: true };
    }
    
    // Function to toggle between search modes
    window.toggleSearchMode = function(mode) {
        const textSection = document.getElementById('text-search-section');
        const permissionSection = document.getElementById('permission-search-section');
        const searchQuery = document.getElementById('search-query');
        
        if (mode === 'text') {
            textSection.classList.remove('hidden');
            permissionSection.classList.add('hidden');
            searchQuery.setAttribute('required', '');
        } else {
            textSection.classList.add('hidden');
            permissionSection.classList.remove('hidden');
            searchQuery.removeAttribute('required');
        }
    };
    
    // Function to perform the advanced search
    window.performAdvancedSearch = function(searchToken = null) {
        const searchMode = document.querySelector('input[name="search-mode"]:checked').value;
        const searchPath = document.getElementById('search-path')?.value || '.';
        const fileExtensions = document.getElementById('file-extensions')?.value || '';
        const maxResults = document.getElementById('max-results')?.value || 1000;
        const recursive = document.getElementById('recursive-search')?.checked || true;
        const batchSize = parseInt(document.getElementById('batch-size')?.value || '200', 10);

        // Text search specific parameters
        const searchQuery = document.getElementById('search-query')?.value || '';
        const caseSensitive = document.getElementById('case-sensitive')?.checked || false;
        const useRegex = document.getElementById('use-regex')?.checked || false;

        // Permission search specific parameters
        const writableOnly = document.getElementById('writable-only')?.checked || false;
        const writableFolders = document.getElementById('writable-folders')?.checked || false;
        const executableOnly = document.getElementById('executable-only')?.checked || false;
        const suidBinaries = document.getElementById('suid-binaries')?.checked || false;
        const includeHidden = document.getElementById('include-hidden')?.checked || false;

        // Validate based on search mode
        if (searchMode === 'text' && !searchQuery && !searchToken) {
            triggerAlert('warning', 'Please enter a search query for text search');
            return;
        } else if (searchMode === 'permission' && !writableOnly && !writableFolders && !executableOnly && !suidBinaries) {
            triggerAlert('warning', 'Please select at least one permission filter');
            return;
        }
        
        // Validate search path if this is a new search
        if (!searchToken) {
            const pathValidation = validateSearchPath(searchPath);
            if (!pathValidation.valid) {
                triggerAlert('warning', pathValidation.message);
                return;
            }
        }
        
        // Get CSRF token and encryption settings from phpVars
        const csrf = window.phpVars?.csrf || '';
        const key = window.phpVars?.encryptionKey || '';
        const isEnc = window.phpVars?.isEnc || false;
        
        // Check if CSRF token is available
        if (!csrf) {
            console.error('CSRF token not found in phpVars');
            triggerAlert('danger', 'Security token missing. Please refresh the page and try again.');
            return;
        }
        
        // Show loading indicator if this is the first search request
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer && !searchToken) {
            resultsContainer.innerHTML = `
                <div class="flex justify-center items-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span class="ml-2 text-gray-600 dark:text-gray-300">Searching...</span>
                </div>
            `;
            
            // Store the search parameters in the window object for continuation
            window.currentSearch = {
                query: searchQuery,
                path: searchPath,
                extensions: fileExtensions,
                maxResults: maxResults,
                caseSensitive: caseSensitive,
                useRegex: useRegex,
                recursive: recursive,
                writableOnly: writableOnly,
                writableFolders: writableFolders,
                executableOnly: executableOnly,
                suidBinaries: suidBinaries,
                includeHidden: includeHidden,
                results: {},
                totalMatches: 0
            };
        } else if (!searchToken) {
            // If no search token but we're calling this function again, it might be a new search
            // Clear previous search results
            window.currentSearch = {
                query: searchQuery,
                path: searchPath,
                extensions: fileExtensions,
                maxResults: maxResults,
                caseSensitive: caseSensitive,
                useRegex: useRegex,
                recursive: recursive,
                writableOnly: writableOnly,
                writableFolders: writableFolders,
                executableOnly: executableOnly,
                suidBinaries: suidBinaries,
                includeHidden: includeHidden,
                results: {},
                totalMatches: 0
            };
        }
        
        // Update progress indicator if this is a continuation
        if (searchToken) {
            const progressElement = document.getElementById('search-progress');
            if (progressElement) {
                progressElement.innerHTML = `
                    <div class="flex items-center">
                        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                        <span>Continuing search...</span>
                    </div>
                `;
            }
        }
        
        console.log('Sending advanced search request:', {
            searchQuery,
            searchPath,
            fileExtensions,
            maxResults,
            caseSensitive,
            useRegex,
            recursive,
            writableOnly,
            writableFolders,
            executableOnly,
            suidBinaries,
            includeHidden,
            searchToken,
            batchSize
        });
        
        // Send search request
        // Format the encryption key properly for CryptoJS
        let encryptionKey = key;
        if (isEnc === '1' && typeof key === 'string') {
            encryptionKey = CryptoJS.enc.Utf8.parse(key);
            console.log('Using formatted encryption key for advanced search');
        }
        
        sendRequest({
            csrf,
            action: 'advanced_search',
            search_mode: searchMode,
            search_query: searchMode === 'text' ? searchQuery : '',  // Only send query for text mode
            search_path: searchPath,
            file_extensions: fileExtensions,
            max_results: maxResults,
            case_sensitive: caseSensitive,
            use_regex: useRegex,
            recursive: recursive,
            writable_only: writableOnly,
            writable_folders: writableFolders,
            executable_only: executableOnly,
            suid_binaries: suidBinaries,
            include_hidden: includeHidden,
            search_token: searchToken,
            batch_size: batchSize
        }, encryptionKey, isEnc)
        .then(response => {
            console.log('Search response received:', response);
            displaySearchResults(response, searchToken !== null);
        })
        .catch(error => {
            console.error('Search error:', error);
            
            if (resultsContainer) {
                resultsContainer.innerHTML = `
                    <div class="text-red-500 dark:text-red-400 text-center py-4">
                        Error: ${error.message || 'Failed to perform search'}
                    </div>
                    <div class="mt-4 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-md">
                        <h3 class="font-medium text-red-800 dark:text-red-300 mb-2">Troubleshooting tips:</h3>
                        <ul class="list-disc pl-5 text-sm text-red-700 dark:text-red-400 space-y-1">
                            <li>Check if the search path exists and is accessible</li>
                            <li>Try using a relative path like "./subdirectory" instead of an absolute path</li>
                            <li>If using regex, verify your pattern is valid</li>
                            <li>Try reducing the batch size if searching many files</li>
                            <li>Check browser console for more detailed error information</li>
                        </ul>
                    </div>
                `;
            }
            
            triggerAlert('danger', 'Search failed: ' + (error.message || 'Unknown error'));
        });
    };
    
    // Function to display search results
    window.displaySearchResults = function(response, isIncremental = false) {
        const resultsContainer = document.getElementById('search-results');
        const searchStats = document.getElementById('search-stats');
        
        if (!resultsContainer) {
            console.error('Results container not found');
            return;
        }
        
        if (response.error) {
            resultsContainer.innerHTML = `
                <div class="text-red-500 dark:text-red-400 text-center py-4">
                    Error: ${response.error}
                </div>
            `;
            return;
        }
        
        // If this is an incremental update, merge the results with the existing ones
        if (isIncremental && window.currentSearch) {
            // Merge new results with existing ones
            Object.assign(window.currentSearch.results, response.results);
            window.currentSearch.totalMatches = response.total_matches;
        } else {
            // Initialize or reset current search data
            if (!window.currentSearch) {
                window.currentSearch = {};
            }
            window.currentSearch.results = response.results;
            window.currentSearch.totalMatches = response.total_matches;
        }
        
        // Update stats
        if (searchStats) {
            searchStats.textContent = `Found ${window.currentSearch.totalMatches} matches in ${Object.keys(window.currentSearch.results).length} files`;
            
            // Add warning if results were truncated due to memory limits
            if (response.memory_limit_reached) {
                searchStats.innerHTML += `
                    <div class="mt-2 text-amber-600 dark:text-amber-400">
                        <svg class="inline-block w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                        </svg>
                        Search was truncated due to memory limits. Try narrowing your search or searching in smaller directories.
                    </div>
                `;
            }
            
            // Add progress information if search is not complete
            if (!response.search_complete) {
                const filesRemaining = response.files_remaining || 0;
                const filesProcessed = response.files_processed || 0;
                const totalFiles = filesProcessed + filesRemaining;
                const progressPercent = totalFiles > 0 ? Math.round((filesProcessed / totalFiles) * 100) : 0;
                
                searchStats.innerHTML += `
                    <div id="search-progress" class="mt-2">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm text-gray-700 dark:text-gray-300">
                                Processed ${filesProcessed} of ${totalFiles} files (${progressPercent}%)
                            </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="flex justify-between mt-2">
                            <div class="flex items-center">
                                <input type="checkbox" id="auto-continue-search" class="mr-2">
                                <label for="auto-continue-search" class="text-sm text-gray-700 dark:text-gray-300">Auto-continue</label>
                            </div>
                            <button id="continue-search" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700">
                                Continue Search
                            </button>
                        </div>
                    </div>
                `;
            }
        }
        
        if (window.currentSearch.totalMatches === 0 && response.search_complete) {
            resultsContainer.innerHTML = `
                <div class="text-gray-500 dark:text-gray-400 text-center py-8">
                    No results found for "${response.search_query}"
                </div>
            `;
            return;
        }
        
        // Generate results HTML
        let resultsHTML = '';
        
        // Sort files by number of matches (most matches first)
        const sortedFiles = Object.keys(window.currentSearch.results).sort((a, b) => {
            return window.currentSearch.results[b].length - window.currentSearch.results[a].length;
        });
        
        sortedFiles.forEach(filePath => {
            const matches = window.currentSearch.results[filePath];
            const fileName = filePath.split('/').pop();
            
            // Check if file is writable
            const isWritable = response.writable_files && response.writable_files.includes(filePath);
            const writableBadge = isWritable ? 
                `<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded">Writable</span>` : 
                '<span class="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 rounded">No Writable</span>';
            
            resultsHTML += `
                <div class="file-result border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mb-4">
                    <div class="file-header bg-gray-100 dark:bg-gray-700 px-4 py-2 flex justify-between items-center">
                        <div class="flex items-center">
                            <span class="font-medium text-gray-800 dark:text-white">${fileName}</span>
                            <span class="ml-2 text-sm text-gray-500 dark:text-gray-400">${matches.length} matches</span>
                            ${writableBadge}
                        </div>
                        <div class="flex space-x-2">
                            <button class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm" 
                                    onclick="viewEditFile('${filePath}', '${window.phpVars?.csrf || ''}', '${window.phpVars?.encryptionKey || ''}', ${window.phpVars?.isEnc || false})">
                                Edit
                            </button>
                            <button class="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-300 text-sm toggle-matches" 
                                    data-file="${filePath}">
                                Hide Matches
                            </button>
                        </div>
                    </div>
                    <div class="file-matches bg-white dark:bg-gray-800 p-2">
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">${filePath}</div>
                        <div class="matches-list space-y-1">
            `;
            
            matches.forEach(match => {
                // Escape HTML in line content
                const escapedContent = match.line_content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                
                // Highlight the match if not using regex
                let highlightedContent = escapedContent;
                if (!document.getElementById('use-regex')?.checked) {
                    const searchQuery = document.getElementById('search-query')?.value || '';
                    if (searchQuery) {
                        // Create a regex to highlight all occurrences, respecting case sensitivity
                        const flags = document.getElementById('case-sensitive')?.checked ? 'g' : 'gi';
                        const regex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
                        highlightedContent = escapedContent.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-700">$&</mark>');
                    }
                }
                
                resultsHTML += `
                    <div class="match-line hover:bg-gray-50 dark:hover:bg-gray-700 p-1 rounded">
                        <a href="#" class="flex" onclick="viewEditFileAtLine('${filePath}', ${match.line_number}, '${window.phpVars?.csrf || ''}', '${window.phpVars?.encryptionKey || ''}', ${window.phpVars?.isEnc || false}); return false;">
                            <span class="line-number w-12 inline-block text-right pr-2 text-gray-500 dark:text-gray-400 select-none">${match.line_number}</span>
                            <span class="line-content font-mono text-gray-800 dark:text-gray-200 overflow-x-auto">${highlightedContent}</span>
                        </a>
                    </div>
                `;
            });
            
            resultsHTML += `
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Update results container
        resultsContainer.innerHTML = resultsHTML;
        
        // Add event listeners to toggle buttons
        document.querySelectorAll('.toggle-matches').forEach(button => {
            button.addEventListener('click', function() {
                const filePath = this.getAttribute('data-file');
                const matchesContainer = this.closest('.file-result').querySelector('.matches-list');
                
                if (matchesContainer.style.display === 'none') {
                    matchesContainer.style.display = 'block';
                    this.textContent = 'Hide Matches';
                } else {
                    matchesContainer.style.display = 'none';
                    this.textContent = 'Show Matches';
                }
            });
        });
        
        // Add event listener to continue search button if search is not complete
        if (!response.search_complete) {
            const continueButton = document.getElementById('continue-search');
            const autoContinueCheckbox = document.getElementById('auto-continue-search');
            
            if (continueButton) {
                continueButton.addEventListener('click', function() {
                    // Continue the search with the token
                    performAdvancedSearch(response.search_token);
                });
            }
            
            // Auto-continue if checkbox is checked
            if (autoContinueCheckbox) {
                // Restore auto-continue preference from localStorage
                const savedAutoContinue = localStorage.getItem('search-auto-continue');
                if (savedAutoContinue === 'true') {
                    autoContinueCheckbox.checked = true;
                }
                
                // Save preference when changed
                autoContinueCheckbox.addEventListener('change', function() {
                    localStorage.setItem('search-auto-continue', this.checked);
                });
                
                // Auto-continue if checked
                if (autoContinueCheckbox.checked) {
                    setTimeout(() => {
                        performAdvancedSearch(response.search_token);
                    }, 1000); // Small delay to allow UI to update
                }
            }
        }
    };
    
    // Function to open a file at a specific line
    window.viewEditFileAtLine = function(filePath, lineNumber, csrf, key, isEnc) {
        console.log(`Attempting to open ${filePath} at line ${lineNumber}`);
        
        // First open the file
        viewEditFile(filePath, csrf, key, isEnc);
        
        // Wait for the editor to initialize with a longer timeout and check for editor existence
        let attempts = 0;
        const maxAttempts = 20; // Increase max attempts
        const checkInterval = 300; // 300ms between checks
        
        const checkEditor = function() {
            console.log(`Checking for editor (attempt ${attempts + 1}/${maxAttempts})`);
            
            if (window.editor) {
                console.log(`Editor found, navigating to line ${lineNumber}`);
                try {
                    // Go to the specified line
                    window.editor.setCursor(lineNumber - 1, 0);
                    
                    // Highlight the line
                    window.editor.addLineClass(lineNumber - 1, 'background', 'bg-yellow-100');
                    
                    // Ensure the line is visible
                    window.editor.scrollIntoView({line: lineNumber - 1, ch: 0}, 100);
                    
                    console.log('Successfully positioned editor at line', lineNumber);
                } catch (error) {
                    console.error('Error positioning editor:', error);
                    triggerAlert('warning', 'Could not position to the selected line. Please try manually navigating to line ' + lineNumber);
                }
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    console.log(`Editor not ready yet, attempt ${attempts}/${maxAttempts}`);
                    setTimeout(checkEditor, checkInterval);
                } else {
                    console.error('Editor failed to initialize after multiple attempts');
                    triggerAlert('warning', 'Could not position to the selected line. Please try manually navigating to line ' + lineNumber);
                }
            }
        };
        
        // Start checking for editor after initial delay
        setTimeout(checkEditor, 800); // Increase initial delay
    };
    
    // Expose clipboard functions
    window.saveToLocalStorage = saveToLocalStorage;
    window.getFromLocalStorage = getFromLocalStorage;
        
    window.freeclipbroad = typeof freeclipbroad === 'function' ? 
        freeclipbroad : function() { console.error('freeclipbroad not found'); };
        
    window.performBulkAction = typeof performBulkAction === 'function' ? 
        performBulkAction : function() { console.error('performBulkAction not found'); };
        
    // Create a global wrapper for sendBulkActionRequest
    window.sendBulkActionRequest = function({ action, files, options = null, onSuccess = null, onError = null }) {
        // Get current state values
        const currentDir = window.fileManagerState?.currentDir || phpVars?.currentDir;
        const csrf = phpVars?.csrf;
        const key = phpVars?.encryptionKey ? CryptoJS.enc.Utf8.parse(phpVars.encryptionKey) : null;
        const isEnc = phpVars?.isEnc;
        
        // Show progress indicator
        if (typeof progr === 'function') progr();
        
        console.log(`Sending ${action} request for ${files.length} file(s)`);
        
        // Prepare data
        const data = {
            csrf: csrf,
            action: action,
            file: files,
            dir: currentDir
        };
        
        // Add options for specific actions
        if (action === 'zip' && options) {
            data.zipExt = options.zipFileName;
            data.compressionLevel = options.compressionLevel || '5';
            data.archiveFormat = options.archiveFormat || 'zip';
        }
        
        // Convert to JSON and encrypt if needed
        const jsonData = JSON.stringify(data);
        const requestData = (isEnc === '1') ? encrypt(jsonData, key) : jsonData;
        
        // Send the request
        $.post('', requestData, function(response) {
            try {
                // Decrypt response if needed
                const decryptedResponse = (isEnc === '1') ? decrypt(response, key) : response;
                const result = JSON.parse(decryptedResponse);
                
                console.log('Response:', result);
                
                if (result.error) {
                    triggerAlert('warning', result.error);
                    if (onError) onError(result.error);
                } else if (result.success) {
                    if (onSuccess) onSuccess(result);
                    else triggerAlert('success', result.success);
                } else {
                    if (onSuccess) onSuccess(result);
                    else triggerAlert('success', 'Operation completed successfully');
                }
            } catch (error) {
                console.error('Error processing response:', error);
                triggerAlert('error', 'Failed to process server response');
                if (onError) onError(error);
            }
            
            // Hide progress indicator
            if (typeof dprogr === 'function') dprogr();
        }).fail(function(xhr, status, error) {
            console.error('Request failed:', status, error);
            triggerAlert('error', 'Request failed: ' + (error || 'Unknown error'));
            if (onError) onError(error);
            if (typeof dprogr === 'function') dprogr();
        });
    };
        
    window.renameFile = typeof renameFile === 'function' ? 
        renameFile : function() { console.error('renameFile not found'); };
        
    window.loadDirectory = typeof loadDirectory === 'function' ? 
        loadDirectory : function() { console.error('loadDirectory not found'); };
        
    window.triggerAlert = typeof triggerAlert === 'function' ? 
        triggerAlert : function() { console.error('triggerAlert not found'); };
        
    window.showConfirmation = typeof showConfirmation === 'function' ? 
        showConfirmation : function() { console.error('showConfirmation not found'); };
        
    // Expose encrypt and decrypt functions
    window.encrypt = typeof encrypt === 'function' ? 
        encrypt : function() { console.error('encrypt not found'); };
        
    window.decrypt = typeof decrypt === 'function' ? 
        decrypt : function() { console.error('decrypt not found'); };
        
    // Expose progress indicator functions
    window.progr = typeof progr === 'function' ? 
        progr : function() { console.error('progr not found'); };
        
    window.dprogr = typeof dprogr === 'function' ? 
        dprogr : function() { console.error('dprogr not found'); };
}

// Function to handle tab switching and ensure navigation elements visibility is updated
function handleTabSwitch(tabId) {
     
    // Get the tab container and content elements
    const tabButton = document.querySelector(`[data-tabs-target="${tabId}"]`);
    const tabContent = document.querySelector(tabId);
    
    if (!tabButton || !tabContent) {
        console.error('Tab elements not found:', tabId);
        return;
    }
    
    // Deactivate all tabs
    document.querySelectorAll('[role="tab"]').forEach(tab => {
        tab.setAttribute('aria-selected', 'false');
        tab.classList.remove('text-blue-600', 'border-blue-600');
        tab.classList.add('border-transparent');
    });
    
    // Hide all system tab contents
    document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
        panel.classList.add('hidden');
    });
    
    // Activate the selected tab
    tabButton.setAttribute('aria-selected', 'true');
    tabButton.classList.add('text-blue-600', 'border-blue-600');
    tabButton.classList.remove('border-transparent');
    
    // Show the selected tab content
    tabContent.classList.remove('hidden');
    tabContent.classList.add('animate-fadeIn');
    
    // Update navigation elements visibility
    const locationTabsContainer = document.querySelector('.mb-4.border-b.border-gray-200.dark\\:border-gray-700');
    const breadcrumbs = document.getElementById('breadcrumbs');
    
    if (locationTabsContainer && breadcrumbs) {
        // Hide for terminal, config, setting, sql, and network tabs
        if (tabId === '#terminal' || tabId === '#config' || tabId === '#setting' || tabId === '#sql' || tabId === '#network') {
            console.log('Hiding navigation elements for tab:', tabId);
            locationTabsContainer.classList.add('hidden');
            breadcrumbs.classList.add('hidden');
            
            // Hide fileManagerUI when switching to system tabs
            const fileManagerUI = document.getElementById('fileManagerUI');
            if (fileManagerUI) {
                fileManagerUI.style.display = 'none';
                fileManagerUI.classList.add('hidden');
            }
            
            // Also hide custom tab content panels
            document.querySelectorAll('.tabs-panel').forEach(panel => {
                panel.classList.add('hidden');
            });
        } else {
             locationTabsContainer.classList.remove('hidden');
            breadcrumbs.classList.remove('hidden');
            
            // If it's the file tab, make sure fileManagerUI is visible
            if (tabId === '#file') {
                const fileManagerUI = document.getElementById('fileManagerUI');
                if (fileManagerUI) {
                    fileManagerUI.style.display = 'block';
                    fileManagerUI.classList.remove('hidden');
                    
                    // Make sure all editor panels are hidden
                    document.querySelectorAll('.tabs-panel').forEach(panel => {
                        panel.classList.add('hidden');
                    });
                }
            }
        }
    }
    
    // Update terminal keyboard listener if needed
    if (typeof window.updateKeydownListener === 'function') {
        setTimeout(window.updateKeydownListener, 100);
    }
}

// Add event listeners to tabs once DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Add click event listeners to all tabs
    document.querySelectorAll('[data-tabs-target]').forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.getAttribute('data-tabs-target');
            handleTabSwitch(target);
        });
    });
    
    // Initial tab setup - find active tab or default to file tab
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const tabId = activeTab ? activeTab.getAttribute('data-tabs-target') : '#file';
    handleTabSwitch(tabId);
});

    window.showConfirmation = typeof showConfirmation === 'function' ? 
        showConfirmation : function() { console.error('showConfirmation not found'); };
        
    // Add diagnostic function
    window.diagnoseFunctions = function() {
        console.log('--- Function Diagnostic Report ---');
        console.log('updateSelectedFiles:', typeof window.updateSelectedFiles === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('saveToLocalStorage:', typeof window.saveToLocalStorage === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('getFromLocalStorage:', typeof window.getFromLocalStorage === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('freeclipbroad:', typeof window.freeclipbroad === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('performBulkAction:', typeof window.performBulkAction === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('renameFile:', typeof window.renameFile === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('loadDirectory:', typeof window.loadDirectory === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('triggerAlert:', typeof window.triggerAlert === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('showConfirmation:', typeof window.showConfirmation === 'function' ? 'Available ✓' : 'Missing ✗');
        console.log('showAdvancedSearch:', typeof window.showAdvancedSearch === 'function' ? 'Available ✓' : 'Missing ✗');
        
        console.log('--- fileManagerState Report ---');
        console.log('fileManagerState:', window.fileManagerState ? 'Available ✓' : 'Missing ✗');
        if (window.fileManagerState) {
            console.log('selectedFiles:', Array.isArray(window.fileManagerState.selectedFiles) ? 
                `Available ✓ (${window.fileManagerState.selectedFiles.length} items)` : 'Missing ✗');
            console.log('currentDir:', window.fileManagerState.currentDir || 'Not set');
        }
        
        console.log('--- phpVars Report ---');
        console.log('phpVars:', window.phpVars ? 'Available ✓' : 'Missing ✗');
        if (window.phpVars) {
            console.log('csrf:', window.phpVars.csrf ? 'Available ✓' : 'Missing ✗');
            console.log('isEnc:', window.phpVars.isEnc !== undefined ? 'Available ✓' : 'Missing ✗');
            console.log('encryptionKey:', window.phpVars.encryptionKey ? 'Available ✓' : 'Missing ✗');
        }
    };
    
    // // Run diagnostic on initialization
    // setTimeout(() => {
    //     if (window.diagnoseFunctions) {
    //         window.diagnoseFunctions();
    //     }
    // }, 1000);
    
 
    // Initialize when DOM is fully loaded
    document.addEventListener('DOMContentLoaded', function() {
         
        // Initialize theme toggle
        initThemeToggle();
        
        // Initialize enhanced tabs
        initEnhancedTabs();
        
        // Initialize settings panel
        initSettings();
        
        // Initialize global keyboard shortcuts
        initGlobalKeyboardShortcuts();
        
        // Expose utility functions to global scope
        exposeUtilityFunctions();
        
        // Ensure phpVars is available globally
        if (typeof phpVars !== 'undefined' && !window.phpVars) {
            window.phpVars = phpVars;
            console.log('phpVars initialized globally');
        } else if (!window.phpVars) {
            console.warn('phpVars not found in global scope');
        }
        
        // Add event listener for advanced search button
        document.querySelector('.advanced-search')?.addEventListener('click', function() {
            if (typeof window.showAdvancedSearch === 'function') {
                window.showAdvancedSearch();
            } else {
                console.error('Advanced search function not found');
                triggerAlert('warning', 'Advanced search feature is not available');
            }
        });
    });

         // Function to save tabs state to localStorage
    window.saveTabsToLocalStorage = function() {
        try {
            // Save tab metadata
            const tabsToSave = fileManagerState.tabs.map(tab => ({
                id: tab.id,
                path: tab.path,
                active: tab.active,
                name: tab.name,
                type: tab.type || 'filemanager'
            }));
            
            // Save active tab ID separately
            localStorage.setItem('fileManager_activeTabId', fileManagerState.activeTabId);
            
            // Save tabs array
            localStorage.setItem('fileManager_tabs', JSON.stringify(tabsToSave));
            
            // For editor tabs, save their file paths separately for reopening
            const editorTabs = fileManagerState.tabs.filter(tab => tab.type === 'editor');
            if (editorTabs.length > 0) {
                const editorFiles = editorTabs.map(tab => tab.path);
                localStorage.setItem('fileManager_openFiles', JSON.stringify(editorFiles));
            }
            
         } catch (error) {
            console.error('Error saving tabs to localStorage:', error);
        }
    }

    // Function to load tabs from localStorage
    window.loadTabsFromLocalStorage = function() {
        try {
            // Get saved tabs
            const savedTabsJson = localStorage.getItem('fileManager_tabs');
            if (!savedTabsJson) {
                console.log('No saved tabs found in localStorage');
                return false;
            }
            
            // Parse saved tabs
            const savedTabs = JSON.parse(savedTabsJson);
            if (!Array.isArray(savedTabs) || savedTabs.length === 0) {
                console.log('Invalid or empty tabs data in localStorage');
                return false;
            }
            
            // Get active tab ID
            const savedActiveTabId = localStorage.getItem('fileManager_activeTabId');
            
            // Restore tabs
            fileManagerState.tabs = savedTabs;
            
            // Restore active tab
            if (savedActiveTabId && fileManagerState.tabs.find(tab => tab.id === savedActiveTabId)) {
                fileManagerState.activeTabId = savedActiveTabId;
                
                // Ensure only one tab is active
                fileManagerState.tabs.forEach(tab => {
                    tab.active = (tab.id === savedActiveTabId);
                });
            } else {
                // If active tab not found, set the first tab as active
                fileManagerState.tabs[0].active = true;
                fileManagerState.activeTabId = fileManagerState.tabs[0].id;
            }
            
             return true;
        } catch (error) {
            console.error('Error loading tabs from localStorage:', error);
            return false;
        }
    }

    // Function to save file paths to localStorage
    function saveToLocalStorage(fileNames) {
        try {
            // Ensure all paths are properly formatted
            const normalizedPaths = fileNames.map(file => {
                // If it's already a full path, use it
                if (file.startsWith('/') || file.includes(':/')) {
                    return file;
                }
                
                // Get current directory from global state
                const currentDir = window.fileManagerState?.currentDir || phpVars?.currentDir;
                
                // Join the paths properly
                if (currentDir.endsWith('/')) {
                    return currentDir + file;
                } else {
                    return currentDir + '/' + file;
                }
            });
            
            localStorage.setItem('copiedFiles', JSON.stringify(normalizedPaths));
            console.log('Saved to clipboard:', normalizedPaths);
            return normalizedPaths;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return [];
        }
    }

    // Function to retrieve file paths from localStorage
    function getFromLocalStorage() {
        try {
            const storedFiles = localStorage.getItem('copiedFiles');
            if (!storedFiles) {
                console.log('No files found in clipboard');
                return [];
            }
            
            const files = JSON.parse(storedFiles);
            console.log('Retrieved from clipboard:', files);
            return files;
        } catch (error) {
            console.error('Error retrieving from localStorage:', error);
            return [];
        }
    }

    // Network Tools Functions
    // Initialize the Network Tools tab when clicked
    document.addEventListener('DOMContentLoaded', function() {
        // Check if Network tab exists
        const networkTab = document.getElementById('network-tab');
        if (networkTab) {
            networkTab.addEventListener('click', function() {
                initNetworkTools();
            });
        }
    });

    // Initialize all network tools
    function initNetworkTools() {
        // Initialize Port Scanner
        const portScannerForm = document.getElementById('portScannerForm');
        if (portScannerForm) {
            portScannerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performPortScan();
            });
        }
        
        // Initialize Network Info button
        const getNetworkInfoBtn = document.getElementById('getNetworkInfo');
        if (getNetworkInfoBtn) {
            getNetworkInfoBtn.addEventListener('click', function() {
                getNetworkInfo();
            });
        }
        
        // Initialize ARP Table button
        const getArpTableBtn = document.getElementById('getArpTable');
        if (getArpTableBtn) {
            getArpTableBtn.addEventListener('click', function() {
                getArpTable();
            });
        }
        
        // Initialize Ping Tool
        const pingForm = document.getElementById('pingForm');
        if (pingForm) {
            pingForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performPing();
            });
        }
        
        // Initialize DNS Lookup Tool
        const dnsLookupForm = document.getElementById('dnsLookupForm');
        if (dnsLookupForm) {
            dnsLookupForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performDnsLookup();
            });
        }
        
        // Initialize Traceroute Tool
        const tracerouteForm = document.getElementById('tracerouteForm');
        if (tracerouteForm) {
            tracerouteForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performTraceroute();
            });
        }
        
        // Initialize Whois Lookup Tool
        const whoisForm = document.getElementById('whoisForm');
        if (whoisForm) {
            whoisForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performWhoisLookup();
            });
        }
    }

    // Port Scanner
    function performPortScan() {
        const host = document.getElementById('hostInput').value;
        const startPort = parseInt(document.getElementById('startPortInput').value);
        const endPort = parseInt(document.getElementById('endPortInput').value);
        const timeout = parseInt(document.getElementById('timeoutInput').value);
        const commonPortsOnly = document.getElementById('commonPortsOnly').checked;
        
        if (!host) {
            triggerAlert('warning', 'Please enter a host/IP address');
            return;
        }
        
        // Show results container and set status
        const resultsContainer = document.getElementById('portScanResults');
        const scanStatus = document.getElementById('scanStatus');
        const resultsBody = document.getElementById('portScanResultsBody');
        
        resultsContainer.classList.remove('hidden');
        scanStatus.textContent = `Scanning ${host}...`;
        resultsBody.innerHTML = '<tr><td colspan="3" class="text-center py-2">Scanning...</td></tr>';
        
        // Send request to server
        const params = {
            host: host,
            start_port: startPort,
            end_port: endPort,
            timeout: timeout,
            common_ports_only: commonPortsOnly
        };
        
        sendNetworkRequest('port_scan', params)
            .then(response => {
                if (response.error) {
                    triggerAlert('warning', response.error);
                    scanStatus.textContent = `Scan failed: ${response.error}`;
                    resultsBody.innerHTML = '<tr><td colspan="3" class="text-center py-2 text-red-500">Scan failed</td></tr>';
                    return;
                }
                
                // Update status
                scanStatus.textContent = `Scan completed for ${response.host}`;
                
                // Clear results table
                resultsBody.innerHTML = '';
                
                // Filter to show only open ports first
                const openPorts = response.results.filter(result => result.status === 'open');
                const closedPorts = response.results.filter(result => result.status === 'closed');
                
                // Add open ports to table
                if (openPorts.length === 0) {
                    resultsBody.innerHTML = '<tr><td colspan="3" class="text-center py-2">No open ports found</td></tr>';
                } else {
                    openPorts.forEach(result => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td class="px-4 py-2">${result.port}</td>
                            <td class="px-4 py-2"><span class="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">open</span></td>
                            <td class="px-4 py-2">${result.service || 'unknown'}</td>
                        `;
                        resultsBody.appendChild(row);
                    });
                    
                    // Add summary row for closed ports
                    if (closedPorts.length > 0) {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td colspan="3" class="px-4 py-2 text-gray-500 italic">${closedPorts.length} port(s) closed or filtered</td>
                        `;
                        resultsBody.appendChild(row);
                    }
                }
            })
            .catch(error => {
                triggerAlert('warning', 'Error performing port scan');
                scanStatus.textContent = 'Scan failed';
                resultsBody.innerHTML = '<tr><td colspan="3" class="text-center py-2 text-red-500">Error connecting to server</td></tr>';
            });
    }

    // Network Information
    function getNetworkInfo() {
        const resultsContainer = document.getElementById('networkInfoResults');
        resultsContainer.classList.remove('hidden');
        resultsContainer.innerHTML = '<div class="text-center py-2">Loading network information...</div>';
        
        sendNetworkRequest('network_info', {})
            .then(response => {
                if (response.error) {
                    triggerAlert('warning', response.error);
                    resultsContainer.innerHTML = `<div class="text-center py-2 text-red-500">${response.error}</div>`;
                    return;
                }
                
                // Display network interfaces
                let html = '<div class="space-y-4">';
                
                if (response.interfaces.length === 0) {
                    html += '<div class="text-center py-2">No network interfaces found</div>';
                } else {
                    response.interfaces.forEach(iface => {
                        html += `
                            <div class="border-b pb-3 dark:border-gray-600">
                                <h4 class="font-medium text-gray-800 dark:text-gray-200">${iface.name}</h4>
                                <div class="mt-2">
                        `;
                        
                        if (iface.addresses.length === 0) {
                            html += '<p class="text-sm text-gray-600 dark:text-gray-400">No addresses</p>';
                        } else {
                            iface.addresses.forEach(addr => {
                                html += `
                                    <div class="flex flex-col text-sm">
                                        <span class="text-gray-700 dark:text-gray-300">
                                            <span class="font-medium">${addr.family}:</span> ${addr.address}
                                        </span>
                                        <span class="text-gray-600 dark:text-gray-400">
                                            Netmask: ${addr.netmask || 'N/A'}
                                        </span>
                                    </div>
                                `;
                            });
                        }
                        
                        html += '</div></div>';
                    });
                }
                
                html += '</div>';
                resultsContainer.innerHTML = html;
            })
            .catch(error => {
                triggerAlert('warning', 'Error getting network information');
                resultsContainer.innerHTML = '<div class="text-center py-2 text-red-500">Error connecting to server</div>';
            });
    }

    // ARP Table
    function getArpTable() {
        const resultsContainer = document.getElementById('arpTableResults');
        resultsContainer.classList.remove('hidden');
        resultsContainer.innerHTML = '<div class="text-center py-2">Loading ARP table...</div>';
        
        sendNetworkRequest('arp_table', {})
            .then(response => {
                if (response.error) {
                    triggerAlert('warning', response.error);
                    resultsContainer.innerHTML = `<div class="text-center py-2 text-red-500">${response.error}</div>`;
                    return;
                }
                
                // Display ARP table
                if (response.arp_table.length === 0) {
                    resultsContainer.innerHTML = '<div class="text-center py-2">No ARP entries found</div>';
                    return;
                }
                
                let html = `
                    <table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800 dark:text-gray-400">
                            <tr>
                                <th scope="col" class="px-4 py-2">IP Address</th>
                                <th scope="col" class="px-4 py-2">MAC Address</th>
                                <th scope="col" class="px-4 py-2">Interface</th>
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                response.arp_table.forEach(entry => {
                    html += `
                        <tr>
                            <td class="px-4 py-2">${entry.ip}</td>
                            <td class="px-4 py-2">${entry.mac}</td>
                            <td class="px-4 py-2">${entry.interface}</td>
                        </tr>
                    `;
                });
                
                html += '</tbody></table>';
                resultsContainer.innerHTML = html;
            })
            .catch(error => {
                triggerAlert('warning', 'Error getting ARP table');
                resultsContainer.innerHTML = '<div class="text-center py-2 text-red-500">Error connecting to server</div>';
            });
    }

    // Ping Tool
    function performPing() {
        const host = document.getElementById('pingHost').value;
        const count = parseInt(document.getElementById('pingCount').value);
        const timeout = parseInt(document.getElementById('pingTimeout').value);
        
        if (!host) {
            triggerAlert('warning', 'Please enter a host/IP address');
            return;
        }
        
        // Show results container
        const resultsContainer = document.getElementById('pingResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Pinging ' + host + '...</div>';
        
        // Send request to server
        const params = {
            host: host,
            count: count,
            timeout: timeout
        };
        
        sendNetworkRequest('ping', params)
            .then(response => {
                if (response.error) {
                    triggerAlert('warning', response.error);
                    resultsDiv.innerHTML = `<div class="text-center py-2 text-red-500">${response.error}</div>`;
                    return;
                }
                
                // Display ping results
                let html = '';
                response.results.forEach(line => {
                    html += line + '<br>';
                });
                
                resultsDiv.innerHTML = html;
            })
            .catch(error => {
                triggerAlert('warning', 'Error performing ping');
                resultsDiv.innerHTML = '<div class="text-center py-2 text-red-500">Error connecting to server</div>';
            });
    }

    // DNS Lookup
    function performDnsLookup() {
        const host = document.getElementById('dnsHost').value;
        const type = document.getElementById('dnsType').value;
        
        if (!host) {
            triggerAlert('warning', 'Please enter a domain name');
            return;
        }
        
        // Show results container
        const resultsContainer = document.getElementById('dnsResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Looking up ' + host + '...</div>';
        
        // Send request to server
        const params = {
            host: host,
            type: type
        };
        
        sendNetworkRequest('dns_lookup', params)
            .then(response => {
                if (response.error) {
                    triggerAlert('warning', response.error);
                    resultsDiv.innerHTML = `<div class="text-center py-2 text-red-500">${response.error}</div>`;
                    return;
                }
                
                // Display DNS results
                if (response.results.length === 0) {
                    resultsDiv.innerHTML = `<div class="text-center py-2">No ${type} records found for ${host}</div>`;
                    return;
                }
                
                let html = `<div class="space-y-4">`;
                
                response.results.forEach(record => {
                    html += `
                        <div class="border-b pb-3 dark:border-gray-600">
                            <h4 class="font-medium text-gray-800 dark:text-gray-200">${record.type} Record</h4>
                            <div class="mt-2 space-y-1">
                    `;
                    
                    // Format record data based on type
                    const data = record.data;
                    for (const [key, value] of Object.entries(data)) {
                        if (key !== 'type' && key !== 'class') {
                            html += `
                                <div class="text-sm">
                                    <span class="font-medium text-gray-700 dark:text-gray-300">${key}:</span>
                                    <span class="text-gray-600 dark:text-gray-400">${value}</span>
                                </div>
                            `;
                        }
                    }
                    
                    html += '</div></div>';
                });
                
                html += '</div>';
                resultsDiv.innerHTML = html;
            })
            .catch(error => {
                triggerAlert('warning', 'Error performing DNS lookup');
                resultsDiv.innerHTML = '<div class="text-center py-2 text-red-500">Error connecting to server</div>';
            });
    }

    // Traceroute Tool
    function performTraceroute() {
        const host = document.getElementById('tracerouteHost').value;
        const maxHops = parseInt(document.getElementById('tracerouteMaxHops').value);
        const timeout = parseInt(document.getElementById('tracerouteTimeout').value);
        
        if (!host) {
            triggerAlert('warning', 'Please enter a host/IP address');
            return;
        }
        
        // Show results container
        const resultsContainer = document.getElementById('tracerouteResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Tracing route to ' + host + '...</div>';
        
        // Send request to server
        const params = {
            host: host,
            max_hops: maxHops,
            timeout: timeout
        };
        
        sendNetworkRequest('traceroute', params)
            .then(response => {
                if (response.error) {
                    triggerAlert('warning', response.error);
                    resultsDiv.innerHTML = `<div class="text-center py-2 text-red-500">${response.error}</div>`;
                    return;
                }
                
                // Display traceroute results
                let html = '<div class="font-mono">';
                html += `<div class="mb-2">Traceroute to ${response.host}, ${maxHops} hops max:</div>`;
                
                response.results.forEach((line, index) => {
                    html += `<div>${line}</div>`;
                });
                
                html += '</div>';
                resultsDiv.innerHTML = html;
            })
            .catch(error => {
                triggerAlert('warning', 'Error performing traceroute');
                resultsDiv.innerHTML = '<div class="text-center py-2 text-red-500">Error connecting to server</div>';
            });
    }
    
    // Whois Lookup Tool
    function performWhoisLookup() {
        const domain = document.getElementById('whoisDomain').value;
        
        if (!domain) {
            triggerAlert('warning', 'Please enter a domain or IP address');
            return;
        }
        
        // Show results container
        const resultsContainer = document.getElementById('whoisResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Looking up WHOIS information for ' + domain + '...</div>';
        
        // Send request to server
        const params = {
            domain: domain
        };
        
        sendNetworkRequest('whois', params)
            .then(response => {
                if (response.error) {
                    triggerAlert('warning', response.error);
                    resultsDiv.innerHTML = `<div class="text-center py-2 text-red-500">${response.error}</div>`;
                    return;
                }
                
                // Display whois results
                if (!response.results) {
                    resultsDiv.innerHTML = `<div class="text-center py-2">No WHOIS information found for ${domain}</div>`;
                    return;
                }
                
                resultsDiv.textContent = response.results;
            })
            .catch(error => {
                triggerAlert('warning', 'Error performing WHOIS lookup');
                resultsDiv.innerHTML = '<div class="text-center py-2 text-red-500">Error connecting to server</div>';
            });
    }

    // Helper function for network requests
    function sendNetworkRequest(tool, params) {
        return new Promise((resolve, reject) => {
            // Show progress indicator
            progr();
            
            const data = {
                action: 'network_tool',
                tool: tool,
                params: params,
                csrf: phpVars.csrf
            };
            
            const jsonData = JSON.stringify(data);
            const isEnc = phpVars.isEnc === '1';
            // Use the correct encryption key format from phpVars
            const key = CryptoJS.enc.Utf8.parse(phpVars.encryptionKey);
            const encryptedData = isEnc ? encrypt(jsonData, key) : jsonData;
            
            fetch('', {
                method: 'POST',
                body: encryptedData
            })
            .then(response => response.text())
            .then(data => {
                try {
                    // Hide progress indicator
                    dprogr();
                    
                    let responseJson;
                    if (isEnc) {
                        // When encryption is enabled, decrypt the response first
                        try {
                            console.log("Attempting to decrypt response");
                            const decryptedData = decrypt(data, key);
                            console.log("Decrypted data:", decryptedData.substring(0, 100) + "...");
                            responseJson = JSON.parse(decryptedData);
                        } catch (decryptError) {
                            console.error("Decryption error:", decryptError);
                            console.log("Attempting direct JSON parse as fallback");
                            // Try direct JSON parse as fallback
                            responseJson = JSON.parse(data);
                        }
                    } else {
                        // When encryption is disabled, parse the response directly
                        responseJson = JSON.parse(data);
                    }
                    
                    resolve(responseJson);
                } catch (error) {
                    console.error("Error processing response:", error);
                    console.error("Raw response:", data);
                    dprogr();
                    reject(error);
                }
            })
            .catch(error => {
                console.error("Network error:", error);
                dprogr();
                reject(error);
            });
        });
    }

    // Function to restore open editor files from localStorage
    function restoreOpenEditorFiles() {
        try {
            // Get saved editor files
            const savedFilesJson = localStorage.getItem('fileManager_openFiles');
            if (!savedFilesJson) {
                console.log('No saved editor files found in localStorage');
                return false;
            }
            
            // Parse saved files
            const savedFiles = JSON.parse(savedFilesJson);
            if (!Array.isArray(savedFiles) || savedFiles.length === 0) {
                console.log('Invalid or empty editor files data in localStorage');
                return false;
            }
            
            console.log('Restoring editor files:', savedFiles);
            
            // Get CSRF token and encryption settings
            const csrf = phpVars.csrf;
            const isEnc = phpVars.isEnc;
            const key = CryptoJS.enc.Utf8.parse(phpVars.encryptionKey);
            
            // Check if files exist before attempting to restore them
            const checkAndRestoreFiles = async () => {
                // Show a loading toast notification
                triggerAlert('info', `Restoring ${savedFiles.length} previously opened files...`);
                
                // Track successful and failed restorations
                const results = {
                    success: [],
                    failed: []
                };
                
                // Process files sequentially to avoid overwhelming the server
                for (let i = 0; i < savedFiles.length; i++) {
                    const filePath = savedFiles[i];
                    
                    try {
                        // Check if file exists first
                        const fileExists = await checkFileExists(filePath, csrf, key, isEnc);
                        
                        if (fileExists) {
                            // Use setTimeout to stagger file opening and avoid UI freezing
                            await new Promise(resolve => {
                                setTimeout(() => {
                                    viewEditFile(filePath, csrf, key, isEnc);
                                    results.success.push(filePath);
                                    resolve();
                                }, 300);
                            });
                        } else {
                            console.warn(`File not found: ${filePath}`);
                            results.failed.push(filePath);
                        }
                    } catch (error) {
                        console.error(`Error restoring file ${filePath}:`, error);
                        results.failed.push(filePath);
                    }
                }
                
                // Update localStorage to remove files that no longer exist
                if (results.failed.length > 0) {
                    const validFiles = savedFiles.filter(file => !results.failed.includes(file));
                    localStorage.setItem('fileManager_openFiles', JSON.stringify(validFiles));
                    
                    // Show warning about failed restorations
                    if (results.failed.length === savedFiles.length) {
                        triggerAlert('warning', 'Could not restore any previously opened files.');
                    } else {
                        triggerAlert('warning', `Restored ${results.success.length} files. ${results.failed.length} files could not be found.`);
                    }
                } else if (results.success.length > 0) {
                    triggerAlert('success', `Successfully restored ${results.success.length} previously opened files.`);
                }
                
                return results.success.length > 0;
            };
            
            // Helper function to check if a file exists
            async function checkFileExists(filePath, csrf, key, isEnc) {
                try {
                    const response = await sendRequest({ 
                        csrf, 
                        action: 'check_file_exists', 
                        file: filePath 
                    }, key, isEnc);
                    
                    return response && response.exists === true;
                } catch (error) {
                    console.error('Error checking if file exists:', error);
                    return false;
                }
            }
            
            // Start the restoration process
            return checkAndRestoreFiles();
        } catch (error) {
            console.error('Error restoring editor files from localStorage:', error);
            triggerAlert('warning', 'Failed to restore previously opened files.');
            return false;
        }
    }



