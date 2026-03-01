import * as Reanimated from "react-native-reanimated";

export namespace Animation {

    export namespace Config {
        export const DefaultAnimationSpeed: number = 400;
        export const DefaultEasing = Reanimated.Easing.bezier(0.5, 0, 0, 1);
    }

    export const DefaultAnimationSpeed = Config.DefaultAnimationSpeed;
    export const DefaultEasing = Config.DefaultEasing;

    export abstract class Presets {
        public static get FadeIn(): Reanimated.FadeInLeft {
            return Reanimated.FadeIn.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeOut(): Reanimated.FadeInLeft {
            return Reanimated.FadeOut.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeInLeft(): Reanimated.FadeInLeft {
            return Reanimated.FadeInLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeOutLeft() {
            return Reanimated.FadeOutLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeInRight() {
            return Reanimated.FadeInRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeOutRight() {
            return Reanimated.FadeOutRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeInDown() {
            return Reanimated.FadeInDown.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeOutDown() {
            return Reanimated.FadeOutDown.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeOutUp() {
            return Reanimated.FadeOutUp.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get FadeInUp() {
            return Reanimated.FadeInUp.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get SlideInLeft() {
            return Reanimated.SlideInLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get SlideOutLeft() {
            return Reanimated.SlideOutLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get SlideInRight() {
            return Reanimated.SlideInRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get SlideOutRight() {
            return Reanimated.SlideOutRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get SlideInDown() {
            return Reanimated.SlideInDown.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get SlideOutDown() {
            return Reanimated.SlideOutDown.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }

        public static get ZoomIn() {
            return Reanimated.ZoomIn.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
        }
    }

    export function _fadeInLeftAnimation() {
        return Reanimated.FadeInLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _fadeOutLeftAnimation() {
        return Reanimated.FadeOutLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _fadeInRightAnimation() {
        return Reanimated.FadeInRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _fadeOutRightAnimation() {
        return Reanimated.FadeOutRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _fadeInDownAnimation() {
        return Reanimated.FadeInDown.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _fadeOutDownAnimation() {
        return Reanimated.FadeOutDown.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _fadeOutUpAnimation() {
        return Reanimated.FadeOutUp.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _fadeInUpAnimation() {
        return Reanimated.FadeInUp.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _slideInLeft() {
        return Reanimated.SlideInLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _slideOutLeft() {
        return Reanimated.SlideOutLeft.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _slideInRight() {
        return Reanimated.SlideInRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }

    export function _slideOutRight() {
        return Reanimated.SlideOutRight.duration(Config.DefaultAnimationSpeed).easing(Config.DefaultEasing);
    }
}