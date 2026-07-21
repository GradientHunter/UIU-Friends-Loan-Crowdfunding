/* ================================================================
   SCRIPT: UIU Friends Network — Homepage
   ================================================================
   This file adds interactivity to the page. It runs AFTER the
   HTML has fully loaded (thanks to DOMContentLoaded below).

   SECTIONS:
   1. Mobile menu toggle
   2. Sticky header shadow on scroll
   3. Fade-in animation when elements scroll into view
   4. Smooth scroll for anchor links  (e.g. href="#how-it-works")
   ================================================================ */


/* Wait until the browser has finished loading all the HTML,
   then run everything inside this function. */
document.addEventListener('DOMContentLoaded', function () {


    /* ============================================================
       1. MOBILE MENU TOGGLE
       Clicking the hamburger button shows/hides the dropdown menu.
       ============================================================ */

    /* Grab the hamburger button and the mobile dropdown menu by their IDs */
    var menuButton = document.getElementById('mobileMenuBtn');
    var mobileMenu = document.getElementById('mobileNav');

    /* Only set up the toggle if both elements exist on the page */
    if (menuButton && mobileMenu) {

        /* When the hamburger button is clicked... */
        menuButton.addEventListener('click', function () {
            /* Toggle the "active" class on the menu.
               "active" is defined in CSS to make the menu visible. */
            mobileMenu.classList.toggle('active');
        });

        /* Close the menu if the user clicks anywhere OUTSIDE of it */
        document.addEventListener('click', function (event) {
            /* Check: is the menu currently open? */
            var menuIsOpen = mobileMenu.classList.contains('active');

            /* Check: did the user click OUTSIDE both the button and the menu? */
            var clickedOutsideButton = !menuButton.contains(event.target);
            var clickedOutsideMenu   = !mobileMenu.contains(event.target);

            if (menuIsOpen && clickedOutsideButton && clickedOutsideMenu) {
                mobileMenu.classList.remove('active');
            }
        });
    }


    /* ============================================================
       2. STICKY HEADER SHADOW ON SCROLL
       Adds a soft drop-shadow to the header once the user scrolls
       down, to make it visually "lift" above the page content.
       ============================================================ */

    /* Find the header element using its class name */
    var header = document.getElementById('siteHeader');

    /* Listen for every scroll event on the window */
    window.addEventListener('scroll', function () {
        /* window.scrollY = how many pixels the page has scrolled down */
        if (window.scrollY > 10) {
            /* User has scrolled down — add the "scrolled" class */
            header.classList.add('scrolled');
        } else {
            /* User is back at the top — remove the shadow */
            header.classList.remove('scrolled');
        }
    });


    /* ============================================================
       3. FADE-IN ANIMATION ON SCROLL
       Elements with the class "fade-in" start invisible.
       When they scroll into the visible part of the screen,
       we add the class "visible" which triggers the CSS animation.
       ============================================================ */

    /* Get ALL elements that have the "fade-in" class */
    var fadeElements = document.querySelectorAll('.fade-in');

    /* IntersectionObserver watches elements and fires a callback
       whenever they enter or leave the visible screen area. */
    var observerSettings = {
        root: null,          /* null = use the browser viewport as the boundary */
        rootMargin: '0px',   /* no extra margin around the viewport */
        threshold: 0.15      /* fire when 15% of the element is visible */
    };

    /* Create the observer with a callback function */
    var scrollObserver = new IntersectionObserver(function (entries) {

        /* "entries" is an array — one entry per watched element */
        entries.forEach(function (entry) {

            /* entry.isIntersecting = true when the element is on screen */
            if (entry.isIntersecting) {
                /* Add "visible" class — CSS will fade + slide the element in */
                entry.target.classList.add('visible');
            }
        });

    }, observerSettings);

    /* Tell the observer to watch each fade-in element */
    fadeElements.forEach(function (element) {
        scrollObserver.observe(element);
    });


    /* ============================================================
       4. SMOOTH SCROLL FOR ANCHOR LINKS
       When clicking a link like <a href="#how-it-works">, instead
       of jumping instantly, the page smoothly scrolls to that section.
       We also account for the fixed header so it doesn't cover content.
       ============================================================ */

    /* Select every <a> tag whose href starts with "#" */
    var anchorLinks = document.querySelectorAll('a[href^="#"]');

    anchorLinks.forEach(function (link) {

        link.addEventListener('click', function (event) {

            /* Stop the default "jump" behaviour */
            event.preventDefault();

            /* Get the target section ID, e.g. "#how-it-works" */
            var targetId = this.getAttribute('href');

            /* If the href is just "#" (a blank link), do nothing */
            if (targetId === '#') return;

            /* Find the section element with that ID */
            var targetSection = document.querySelector(targetId);

            if (targetSection) {

                /* Close the mobile menu first if it's open */
                if (mobileMenu && mobileMenu.classList.contains('active')) {
                    mobileMenu.classList.remove('active');
                }

                /* Calculate where to scroll:
                   - getBoundingClientRect().top = distance from top of viewport
                   - window.pageYOffset            = how far page is already scrolled
                   - header.offsetHeight           = height of the fixed header
                   Subtracting the header height stops the header from
                   covering the section title. */
                var headerHeight      = header.offsetHeight;
                var distanceFromTop   = targetSection.getBoundingClientRect().top;
                var currentScroll     = window.pageYOffset;
                var scrollDestination = distanceFromTop + currentScroll - headerHeight;

                /* Smoothly scroll to the calculated position */
                window.scrollTo({
                    top: scrollDestination,
                    behavior: 'smooth'
                });
            }
        });
    });


}); /* End of DOMContentLoaded */
