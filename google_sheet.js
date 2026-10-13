    // google_sheet.js functionality - embedded directly
    (function() {
        'use strict';
        
        // Configuration - REPLACE WITH YOUR ACTUAL VALUES
        const CONFIG = {
            sheetId: 'YOUR_GOOGLE_SHEET_ID', // Get from sheet URL
            apiKey: 'YOUR_API_KEY', // Get from Google Cloud Console
            sheetName: 'Portfolio' // Your sheet name
        };
        
        // Function to load projects from Google Sheets
        async function loadProjectsFromSheet() {
            try {
                const url = `https://opensheet.vercel.app/${CONFIG.sheetId}/${CONFIG.sheetName}`;
                const response = await fetch(url);
                const projects = await response.json();
                
                console.log('Loaded projects:', projects);
                
                // Render projects to your portfolio section
                renderPortfolioProjects(projects);
                
            } catch (error) {
                console.error('Error loading projects:', error);
                // Fallback to static content
                console.log('Using static portfolio content');
            }
        }
        
        // Render projects dynamically
        function renderPortfolioProjects(projects) {
            const portfolioContainer = document.querySelector('.portfolio-items');
            if (!portfolioContainer) return;
            
            // Clear existing content
            portfolioContainer.innerHTML = '';
            
            // Add each project
            projects.forEach(project => {
                const projectHtml = `
                    <div class="column mix mb_30 col-md-6 col-lg-4 ${project.category || ''}">
                        <div class="portfolio-card">
                            <div class="preview-wrapper">
                                <img src="${project.image || 'assets/images/placeholder.jpg'}" 
                                     class="preview-img" 
                                     alt="${project.title}">
                                <div class="action-buttons">
                                    <a href="${project.url}" target="_blank" class="preview-btn live-btn">
                                        <i class="fas fa-external-link-alt"></i> Visit Live
                                    </a>
                                </div>
                            </div>
                            <div class="portfolio-info">
                                <h5 class="portfolio-title">${project.title}</h5>
                                <p class="portfolio-desc">${project.description}</p>
                                <div class="tech-tags">
                                    ${project.technologies.split(',').map(tech => 
                                        `<span class="badge bg-primary">${tech.trim()}</span>`
                                    ).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                portfolioContainer.insertAdjacentHTML('beforeend', projectHtml);
            });
        }
        
        // Load projects when page is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadProjectsFromSheet);
        } else {
            loadProjectsFromSheet();
        }
    })();