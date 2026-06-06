// This array is regenerated automatically by build-photos.sh.
// Do not edit by hand — run ./build-photos.sh after adding photos.
const images = [
    "476632914-1948249909031088-7620311370900396906-n.jpg",
    "477825932-1950456752143737-2038986121059667914-n.jpg",
    "481908176-1967791407076938-7742205264705016179-n.jpg",
    "50014536-1076802625824529-6471520476660236288-n.jpg",
    "50060740-1076802579157867-4051919730989072384-n.jpg",
    "50061744-1076802642491194-3020977625460899840-n.jpg",
    "50099178-1076802692491189-8492912247151001600-n.jpg",
    "50567128-1076802602491198-4789617756062351360-n.jpg",
    "524623479-10162958447463211-872477910123938032-n.jpg",
    "631551610-10164530976306115-6422071470549203078-n.jpg",
    "652341474-10239075160875201-5211773503527440892-n.jpg",
    "678233829-1415378627295802-6765771274895789683-n.jpg",
    "679180417-26748729891433576-3530404346790995994-n.jpg",
    "680125902-26748729401433625-7698045273332052504-n.jpg",
    "681118778-26748730541433511-8365708696010792109-n.jpg",
    "681296171-1415378623962469-3337492188158726545-n.jpg",
    "682387043-26748730284766870-5410950613876766734-n.jpg",
    "684095137-1415378630629135-8976050921328371887-n.jpg",
    "685111926-3921880001448226-623966192669093632-n.jpg",
    "686200250-3921880144781545-147043869614871148-n.jpg",
    "687029874-3921880344781525-512658489254298672-n.jpg",
    "687689605-3921880268114866-4622301868541587104-n.jpg",
];

document.addEventListener('DOMContentLoaded', () => {
    const galleryGrid = document.getElementById('gallery-grid');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const closeBtn = document.querySelector('.close-btn');
    const prevBtn = document.querySelector('.prev-btn');
    const nextBtn = document.querySelector('.next-btn');
    const playBtn = document.getElementById('play-slideshow');

    // The slideshow plays the full gallery (the hero photo is included in the
    // gallery, so it appears here too — no need to prepend it separately).
    const slideshowImages = images;
    let activeList = images;
    let currentIndex = 0;

    // Slideshow state
    const SLIDE_INTERVAL = 5000; // 5 seconds per photo
    let slideshowTimer = null;
    let slideshowActive = false;

    // Populate gallery
    images.forEach((img, index) => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `<img src="images/${img}" alt="Memory of Jeff" loading="lazy">`;
        item.addEventListener('click', () => openLightbox(index, images));
        galleryGrid.appendChild(item);
    });

    // Lightbox functions
    function openLightbox(index, list) {
        activeList = list || images;
        currentIndex = index;
        updateLightboxImage();
        lightbox.style.display = 'block';
        // Trigger reflow
        lightbox.offsetHeight;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent scrolling background
    }

    function close() {
        stopSlideshow();
        lightbox.classList.remove('active');
        setTimeout(() => {
            lightbox.style.display = 'none';
            document.body.style.overflow = '';
        }, 300);
    }

    function updateLightboxImage() {
        lightboxImg.style.opacity = '0.5';
        setTimeout(() => {
            const currentImg = new Image();
            currentImg.src = `images/${activeList[currentIndex]}`;

            currentImg.onload = () => {
                lightboxImg.src = currentImg.src;

                // Calculate aspect ratio
                const aspectRatio = currentImg.width / currentImg.height;
                const viewRatio = window.innerWidth / window.innerHeight;

                // Ensure image is at least 80% of the screen
                if (aspectRatio > viewRatio) {
                    // Landscape relative to screen
                    lightboxImg.style.width = '80vw';
                    lightboxImg.style.height = 'auto';
                } else {
                    // Portrait relative to screen
                    lightboxImg.style.height = '80vh';
                    lightboxImg.style.width = 'auto';
                }

                lightboxImg.style.opacity = '1';
            };
        }, 150);
    }

    function showNext() {
        currentIndex = (currentIndex + 1) % activeList.length;
        updateLightboxImage();
    }

    function showPrev() {
        currentIndex = (currentIndex - 1 + activeList.length) % activeList.length;
        updateLightboxImage();
    }

    // Slideshow: full-screen, auto-advancing loop for casting to a TV.
    function startSlideshow() {
        slideshowActive = true;
        lightbox.classList.add('slideshow-mode');
        openLightbox(0, slideshowImages);

        // Request full-screen where supported (desktop browsers). Harmless
        // no-op on iOS Safari, where the lightbox already fills the viewport.
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
            try { req.call(el); } catch (err) { /* ignore */ }
        }

        clearInterval(slideshowTimer);
        slideshowTimer = setInterval(showNext, SLIDE_INTERVAL);
    }

    function stopSlideshow() {
        if (!slideshowActive) return;
        slideshowActive = false;
        clearInterval(slideshowTimer);
        slideshowTimer = null;
        lightbox.classList.remove('slideshow-mode');
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            const exit = document.exitFullscreen || document.webkitExitFullscreen;
            if (exit) {
                try { exit.call(document); } catch (err) { /* ignore */ }
            }
        }
    }

    // Event Listeners
    closeBtn.addEventListener('click', close);
    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); stopSlideshow(); showNext(); });
    prevBtn.addEventListener('click', (e) => { e.stopPropagation(); stopSlideshow(); showPrev(); });
    if (playBtn) playBtn.addEventListener('click', startSlideshow);

    // Close on clicking outside image (also exits the slideshow)
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-content-wrapper')
            || e.target === lightboxImg) {
            close();
        }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;

        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight') { stopSlideshow(); showNext(); }
        if (e.key === 'ArrowLeft') { stopSlideshow(); showPrev(); }
    });

    // If the user leaves full-screen (e.g. presses Esc on the OS overlay),
    // tear the slideshow down so state stays consistent.
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && slideshowActive) close();
    });
});
