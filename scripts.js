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
