$(document).ready(function(){
    $('.screenshots').slick({
        dots: true,
        infinite: true, // Включаем бесконечную прокрутку
        speed: 300,
        slidesToShow: 1,
        centerMode: true,
        variableWidth: true,
        adaptiveHeight: true
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const burgerMenu = document.querySelector('.burger-menu');
    const navMenu = document.querySelector('header nav');

    burgerMenu.addEventListener('click', function() {
        navMenu.classList.toggle('active');
    });
});

