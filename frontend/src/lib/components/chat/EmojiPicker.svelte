<script lang="ts">
  import type { CustomEmoji } from '@harmony/shared/types/emoji';
  import { AssetScope } from '@harmony/shared/types/emoji';
  import { api } from '$lib/api/client';
  import { auth } from '$lib/stores/auth.svelte';
  import { getLocalEmojis, saveLocalEmoji } from '$lib/utils/local-storage';

  interface UnicodeEmoji {
    emoji: string;
    name: string;
    category: string;
  }

  interface Props {
    onselect: (emoji: { unicode?: string; custom?: CustomEmoji; local?: { id: string; name: string; blob: Blob } }) => void;
    onclose?: () => void;
    serverId?: string;
  }

  let { onselect, onclose, serverId }: Props = $props();

  // Unicode emoji data — curated subset of popular emojis
  const UNICODE_EMOJIS: UnicodeEmoji[] = [
    // Smileys
    { emoji: '😀', name: 'grinning', category: 'Smileys' },
    { emoji: '😃', name: 'smiley', category: 'Smileys' },
    { emoji: '😄', name: 'smile', category: 'Smileys' },
    { emoji: '😁', name: 'grin', category: 'Smileys' },
    { emoji: '😆', name: 'laughing', category: 'Smileys' },
    { emoji: '😅', name: 'sweat_smile', category: 'Smileys' },
    { emoji: '🤣', name: 'rofl', category: 'Smileys' },
    { emoji: '😂', name: 'joy', category: 'Smileys' },
    { emoji: '🙂', name: 'slightly_smiling_face', category: 'Smileys' },
    { emoji: '🙃', name: 'upside_down_face', category: 'Smileys' },
    { emoji: '😉', name: 'wink', category: 'Smileys' },
    { emoji: '😊', name: 'blush', category: 'Smileys' },
    { emoji: '😇', name: 'innocent', category: 'Smileys' },
    { emoji: '🥰', name: 'smiling_face_with_hearts', category: 'Smileys' },
    { emoji: '😍', name: 'heart_eyes', category: 'Smileys' },
    { emoji: '🤩', name: 'star_struck', category: 'Smileys' },
    { emoji: '😘', name: 'kissing_heart', category: 'Smileys' },
    { emoji: '😗', name: 'kissing', category: 'Smileys' },
    { emoji: '😚', name: 'kissing_closed_eyes', category: 'Smileys' },
    { emoji: '😙', name: 'kissing_smiling_eyes', category: 'Smileys' },
    { emoji: '🥲', name: 'smiling_face_with_tear', category: 'Smileys' },
    { emoji: '😋', name: 'yum', category: 'Smileys' },
    { emoji: '😛', name: 'stuck_out_tongue', category: 'Smileys' },
    { emoji: '😜', name: 'stuck_out_tongue_winking_eye', category: 'Smileys' },
    { emoji: '🤪', name: 'zany_face', category: 'Smileys' },
    { emoji: '😝', name: 'stuck_out_tongue_closed_eyes', category: 'Smileys' },
    { emoji: '🤑', name: 'money_mouth_face', category: 'Smileys' },
    { emoji: '🤗', name: 'hugs', category: 'Smileys' },
    { emoji: '🤭', name: 'hand_over_mouth', category: 'Smileys' },
    { emoji: '🤫', name: 'shushing_face', category: 'Smileys' },
    { emoji: '🤔', name: 'thinking', category: 'Smileys' },
    { emoji: '🤐', name: 'zipper_mouth_face', category: 'Smileys' },
    { emoji: '🤨', name: 'raised_eyebrow', category: 'Smileys' },
    { emoji: '😐', name: 'neutral_face', category: 'Smileys' },
    { emoji: '😑', name: 'expressionless', category: 'Smileys' },
    { emoji: '😶', name: 'no_mouth', category: 'Smileys' },
    { emoji: '😏', name: 'smirk', category: 'Smileys' },
    { emoji: '😒', name: 'unamused', category: 'Smileys' },
    { emoji: '🙄', name: 'roll_eyes', category: 'Smileys' },
    { emoji: '😬', name: 'grimacing', category: 'Smileys' },
    { emoji: '😮‍💨', name: 'exhaling', category: 'Smileys' },
    { emoji: '🤥', name: 'lying_face', category: 'Smileys' },
    { emoji: '😌', name: 'relieved', category: 'Smileys' },
    { emoji: '😔', name: 'pensive', category: 'Smileys' },
    { emoji: '😪', name: 'sleepy', category: 'Smileys' },
    { emoji: '🤤', name: 'drooling_face', category: 'Smileys' },
    { emoji: '😴', name: 'sleeping', category: 'Smileys' },
    { emoji: '😷', name: 'mask', category: 'Smileys' },
    { emoji: '🤒', name: 'face_with_thermometer', category: 'Smileys' },
    { emoji: '🤕', name: 'face_with_head_bandage', category: 'Smileys' },
    { emoji: '🤢', name: 'nauseated_face', category: 'Smileys' },
    { emoji: '🤮', name: 'vomiting_face', category: 'Smileys' },
    { emoji: '🤧', name: 'sneezing_face', category: 'Smileys' },
    { emoji: '🥵', name: 'hot_face', category: 'Smileys' },
    { emoji: '🥶', name: 'cold_face', category: 'Smileys' },
    { emoji: '🥴', name: 'woozy_face', category: 'Smileys' },
    { emoji: '😵', name: 'dizzy_face', category: 'Smileys' },
    { emoji: '🤯', name: 'exploding_head', category: 'Smileys' },
    { emoji: '🤠', name: 'cowboy_hat_face', category: 'Smileys' },
    { emoji: '🥳', name: 'partying_face', category: 'Smileys' },
    { emoji: '🥸', name: 'disguised_face', category: 'Smileys' },
    { emoji: '😎', name: 'sunglasses', category: 'Smileys' },
    { emoji: '🤓', name: 'nerd_face', category: 'Smileys' },
    { emoji: '🧐', name: 'monocle_face', category: 'Smileys' },
    { emoji: '😕', name: 'confused', category: 'Smileys' },
    { emoji: '😟', name: 'worried', category: 'Smileys' },
    { emoji: '🙁', name: 'slightly_frowning_face', category: 'Smileys' },
    { emoji: '☹️', name: 'frowning_face', category: 'Smileys' },
    { emoji: '😮', name: 'open_mouth', category: 'Smileys' },
    { emoji: '😯', name: 'hushed', category: 'Smileys' },
    { emoji: '😲', name: 'astonished', category: 'Smileys' },
    { emoji: '😳', name: 'flushed', category: 'Smileys' },
    { emoji: '🥺', name: 'pleading_face', category: 'Smileys' },
    { emoji: '😦', name: 'frowning', category: 'Smileys' },
    { emoji: '😧', name: 'anguished', category: 'Smileys' },
    { emoji: '😨', name: 'fearful', category: 'Smileys' },
    { emoji: '😰', name: 'cold_sweat', category: 'Smileys' },
    { emoji: '😥', name: 'disappointed_relieved', category: 'Smileys' },
    { emoji: '😢', name: 'cry', category: 'Smileys' },
    { emoji: '😭', name: 'sob', category: 'Smileys' },
    { emoji: '😱', name: 'scream', category: 'Smileys' },
    { emoji: '😖', name: 'confounded', category: 'Smileys' },
    { emoji: '😣', name: 'persevere', category: 'Smileys' },
    { emoji: '😞', name: 'disappointed', category: 'Smileys' },
    { emoji: '😓', name: 'sweat', category: 'Smileys' },
    { emoji: '😩', name: 'weary', category: 'Smileys' },
    { emoji: '😫', name: 'tired_face', category: 'Smileys' },
    { emoji: '🥱', name: 'yawning_face', category: 'Smileys' },
    { emoji: '😤', name: 'triumph', category: 'Smileys' },
    { emoji: '😡', name: 'rage', category: 'Smileys' },
    { emoji: '😠', name: 'angry', category: 'Smileys' },
    { emoji: '🤬', name: 'cursing_face', category: 'Smileys' },
    { emoji: '😈', name: 'smiling_imp', category: 'Smileys' },
    { emoji: '👿', name: 'imp', category: 'Smileys' },
    { emoji: '💀', name: 'skull', category: 'Smileys' },
    { emoji: '☠️', name: 'skull_crossbones', category: 'Smileys' },
    { emoji: '💩', name: 'poop', category: 'Smileys' },
    { emoji: '🤡', name: 'clown_face', category: 'Smileys' },
    { emoji: '👹', name: 'japanese_ogre', category: 'Smileys' },
    { emoji: '👺', name: 'japanese_goblin', category: 'Smileys' },
    { emoji: '👻', name: 'ghost', category: 'Smileys' },
    { emoji: '👽', name: 'alien', category: 'Smileys' },
    { emoji: '👾', name: 'space_invader', category: 'Smileys' },
    { emoji: '🤖', name: 'robot', category: 'Smileys' },
    // People
    { emoji: '👋', name: 'wave', category: 'People' },
    { emoji: '🤚', name: 'raised_back_of_hand', category: 'People' },
    { emoji: '🖐️', name: 'hand_splayed', category: 'People' },
    { emoji: '✋', name: 'raised_hand', category: 'People' },
    { emoji: '🖖', name: 'vulcan_salute', category: 'People' },
    { emoji: '👌', name: 'ok_hand', category: 'People' },
    { emoji: '🤌', name: 'pinched_fingers', category: 'People' },
    { emoji: '✌️', name: 'v', category: 'People' },
    { emoji: '🤞', name: 'crossed_fingers', category: 'People' },
    { emoji: '🤟', name: 'love_you_gesture', category: 'People' },
    { emoji: '🤘', name: 'metal', category: 'People' },
    { emoji: '🤙', name: 'call_me_hand', category: 'People' },
    { emoji: '👈', name: 'point_left', category: 'People' },
    { emoji: '👉', name: 'point_right', category: 'People' },
    { emoji: '👆', name: 'point_up_2', category: 'People' },
    { emoji: '🖕', name: 'middle_finger', category: 'People' },
    { emoji: '👇', name: 'point_down', category: 'People' },
    { emoji: '☝️', name: 'point_up', category: 'People' },
    { emoji: '👍', name: '+1', category: 'People' },
    { emoji: '👎', name: '-1', category: 'People' },
    { emoji: '✊', name: 'fist_raised', category: 'People' },
    { emoji: '👊', name: 'facepunch', category: 'People' },
    { emoji: '🤛', name: 'fist_left', category: 'People' },
    { emoji: '🤜', name: 'fist_right', category: 'People' },
    { emoji: '👏', name: 'clap', category: 'People' },
    { emoji: '🙌', name: 'raised_hands', category: 'People' },
    { emoji: '👐', name: 'open_hands', category: 'People' },
    { emoji: '🤲', name: 'palms_up_together', category: 'People' },
    { emoji: '🙏', name: 'pray', category: 'People' },
    { emoji: '✍️', name: 'writing_hand', category: 'People' },
    { emoji: '💅', name: 'nail_care', category: 'People' },
    { emoji: '🤳', name: 'selfie', category: 'People' },
    { emoji: '💪', name: 'muscle', category: 'People' },
    { emoji: '🦾', name: 'mechanical_arm', category: 'People' },
    { emoji: '🦿', name: 'mechanical_leg', category: 'People' },
    { emoji: '🦵', name: 'leg', category: 'People' },
    { emoji: '🦶', name: 'foot', category: 'People' },
    { emoji: '👂', name: 'ear', category: 'People' },
    { emoji: '🦻', name: 'ear_with_hearing_aid', category: 'People' },
    { emoji: '👃', name: 'nose', category: 'People' },
    { emoji: '🧠', name: 'brain', category: 'People' },
    { emoji: '🫀', name: 'anatomical_heart', category: 'People' },
    { emoji: '🫁', name: 'lungs', category: 'People' },
    { emoji: '🦷', name: 'tooth', category: 'People' },
    { emoji: '🦴', name: 'bone', category: 'People' },
    { emoji: '👀', name: 'eyes', category: 'People' },
    { emoji: '👁️', name: 'eye', category: 'People' },
    { emoji: '👅', name: 'tongue', category: 'People' },
    { emoji: '👄', name: 'lips', category: 'People' },
    // Nature
    { emoji: '🌱', name: 'seedling', category: 'Nature' },
    { emoji: '🌿', name: 'herb', category: 'Nature' },
    { emoji: '🍀', name: 'four_leaf_clover', category: 'Nature' },
    { emoji: '🌲', name: 'evergreen_tree', category: 'Nature' },
    { emoji: '🌳', name: 'deciduous_tree', category: 'Nature' },
    { emoji: '🌴', name: 'palm_tree', category: 'Nature' },
    { emoji: '🌵', name: 'cactus', category: 'Nature' },
    { emoji: '🌾', name: 'ear_of_rice', category: 'Nature' },
    { emoji: '🌺', name: 'hibiscus', category: 'Nature' },
    { emoji: '🌸', name: 'cherry_blossom', category: 'Nature' },
    { emoji: '🌼', name: 'blossom', category: 'Nature' },
    { emoji: '🌻', name: 'sunflower', category: 'Nature' },
    { emoji: '🌹', name: 'rose', category: 'Nature' },
    { emoji: '🥀', name: 'wilted_flower', category: 'Nature' },
    { emoji: '🌷', name: 'tulip', category: 'Nature' },
    { emoji: '🐶', name: 'dog', category: 'Nature' },
    { emoji: '🐱', name: 'cat', category: 'Nature' },
    { emoji: '🐭', name: 'mouse', category: 'Nature' },
    { emoji: '🐹', name: 'hamster', category: 'Nature' },
    { emoji: '🐰', name: 'rabbit', category: 'Nature' },
    { emoji: '🦊', name: 'fox_face', category: 'Nature' },
    { emoji: '🐻', name: 'bear', category: 'Nature' },
    { emoji: '🐼', name: 'panda_face', category: 'Nature' },
    { emoji: '🐨', name: 'koala', category: 'Nature' },
    { emoji: '🐯', name: 'tiger', category: 'Nature' },
    { emoji: '🦁', name: 'lion', category: 'Nature' },
    { emoji: '🐮', name: 'cow', category: 'Nature' },
    { emoji: '🐷', name: 'pig', category: 'Nature' },
    { emoji: '🐸', name: 'frog', category: 'Nature' },
    { emoji: '🐵', name: 'monkey_face', category: 'Nature' },
    { emoji: '🐔', name: 'chicken', category: 'Nature' },
    { emoji: '🐧', name: 'penguin', category: 'Nature' },
    { emoji: '🐦', name: 'bird', category: 'Nature' },
    { emoji: '🦋', name: 'butterfly', category: 'Nature' },
    { emoji: '🐛', name: 'bug', category: 'Nature' },
    { emoji: '🐝', name: 'bee', category: 'Nature' },
    { emoji: '🐞', name: 'ladybug', category: 'Nature' },
    { emoji: '🦀', name: 'crab', category: 'Nature' },
    { emoji: '🐙', name: 'octopus', category: 'Nature' },
    { emoji: '🦈', name: 'shark', category: 'Nature' },
    { emoji: '🐬', name: 'dolphin', category: 'Nature' },
    { emoji: '🐳', name: 'whale', category: 'Nature' },
    { emoji: '🦁', name: 'lion_face', category: 'Nature' },
    { emoji: '🌍', name: 'earth_africa', category: 'Nature' },
    { emoji: '🌎', name: 'earth_americas', category: 'Nature' },
    { emoji: '🌏', name: 'earth_asia', category: 'Nature' },
    { emoji: '🌙', name: 'crescent_moon', category: 'Nature' },
    { emoji: '☀️', name: 'sunny', category: 'Nature' },
    { emoji: '⭐', name: 'star', category: 'Nature' },
    { emoji: '🌟', name: 'star2', category: 'Nature' },
    { emoji: '⚡', name: 'zap', category: 'Nature' },
    { emoji: '🔥', name: 'fire', category: 'Nature' },
    { emoji: '❄️', name: 'snowflake', category: 'Nature' },
    { emoji: '🌈', name: 'rainbow', category: 'Nature' },
    { emoji: '☁️', name: 'cloud', category: 'Nature' },
    { emoji: '🌊', name: 'ocean', category: 'Nature' },
    // Food
    { emoji: '🍎', name: 'apple', category: 'Food' },
    { emoji: '🍊', name: 'tangerine', category: 'Food' },
    { emoji: '🍋', name: 'lemon', category: 'Food' },
    { emoji: '🍇', name: 'grapes', category: 'Food' },
    { emoji: '🍓', name: 'strawberry', category: 'Food' },
    { emoji: '🍒', name: 'cherries', category: 'Food' },
    { emoji: '🍑', name: 'peach', category: 'Food' },
    { emoji: '🍌', name: 'banana', category: 'Food' },
    { emoji: '🥝', name: 'kiwi_fruit', category: 'Food' },
    { emoji: '🍅', name: 'tomato', category: 'Food' },
    { emoji: '🥑', name: 'avocado', category: 'Food' },
    { emoji: '🥦', name: 'broccoli', category: 'Food' },
    { emoji: '🌽', name: 'corn', category: 'Food' },
    { emoji: '🍕', name: 'pizza', category: 'Food' },
    { emoji: '🍔', name: 'hamburger', category: 'Food' },
    { emoji: '🍟', name: 'fries', category: 'Food' },
    { emoji: '🌮', name: 'taco', category: 'Food' },
    { emoji: '🌯', name: 'burrito', category: 'Food' },
    { emoji: '🍜', name: 'ramen', category: 'Food' },
    { emoji: '🍣', name: 'sushi', category: 'Food' },
    { emoji: '🍦', name: 'icecream', category: 'Food' },
    { emoji: '🍩', name: 'doughnut', category: 'Food' },
    { emoji: '🍪', name: 'cookie', category: 'Food' },
    { emoji: '🎂', name: 'birthday', category: 'Food' },
    { emoji: '🍫', name: 'chocolate_bar', category: 'Food' },
    { emoji: '🍭', name: 'lollipop', category: 'Food' },
    { emoji: '☕', name: 'coffee', category: 'Food' },
    { emoji: '🍵', name: 'tea', category: 'Food' },
    { emoji: '🧃', name: 'beverage_box', category: 'Food' },
    { emoji: '🥤', name: 'cup_with_straw', category: 'Food' },
    { emoji: '🍺', name: 'beer', category: 'Food' },
    { emoji: '🥂', name: 'clinking_glasses', category: 'Food' },
    { emoji: '🍷', name: 'wine_glass', category: 'Food' },
    // Activities
    { emoji: '⚽', name: 'soccer', category: 'Activities' },
    { emoji: '🏀', name: 'basketball', category: 'Activities' },
    { emoji: '🏈', name: 'football', category: 'Activities' },
    { emoji: '⚾', name: 'baseball', category: 'Activities' },
    { emoji: '🎾', name: 'tennis', category: 'Activities' },
    { emoji: '🏐', name: 'volleyball', category: 'Activities' },
    { emoji: '🏉', name: 'rugby_football', category: 'Activities' },
    { emoji: '🥊', name: 'boxing_glove', category: 'Activities' },
    { emoji: '🎯', name: 'dart', category: 'Activities' },
    { emoji: '🎱', name: '8ball', category: 'Activities' },
    { emoji: '🎮', name: 'video_game', category: 'Activities' },
    { emoji: '🕹️', name: 'joystick', category: 'Activities' },
    { emoji: '🎲', name: 'game_die', category: 'Activities' },
    { emoji: '♟️', name: 'chess_pawn', category: 'Activities' },
    { emoji: '🎭', name: 'performing_arts', category: 'Activities' },
    { emoji: '🎨', name: 'art', category: 'Activities' },
    { emoji: '🎸', name: 'guitar', category: 'Activities' },
    { emoji: '🎹', name: 'musical_keyboard', category: 'Activities' },
    { emoji: '🥁', name: 'drum', category: 'Activities' },
    { emoji: '🎷', name: 'saxophone', category: 'Activities' },
    { emoji: '🎺', name: 'trumpet', category: 'Activities' },
    { emoji: '🎵', name: 'musical_note', category: 'Activities' },
    { emoji: '🎶', name: 'notes', category: 'Activities' },
    { emoji: '🏆', name: 'trophy', category: 'Activities' },
    { emoji: '🥇', name: 'first_place_medal', category: 'Activities' },
    { emoji: '🎖️', name: 'medal_military', category: 'Activities' },
    { emoji: '🎗️', name: 'reminder_ribbon', category: 'Activities' },
    { emoji: '🎟️', name: 'tickets', category: 'Activities' },
    { emoji: '🎪', name: 'circus_tent', category: 'Activities' },
    // Objects
    { emoji: '💻', name: 'computer', category: 'Objects' },
    { emoji: '🖥️', name: 'desktop_computer', category: 'Objects' },
    { emoji: '📱', name: 'iphone', category: 'Objects' },
    { emoji: '⌨️', name: 'keyboard', category: 'Objects' },
    { emoji: '🖨️', name: 'printer', category: 'Objects' },
    { emoji: '📷', name: 'camera', category: 'Objects' },
    { emoji: '📸', name: 'camera_flash', category: 'Objects' },
    { emoji: '📺', name: 'tv', category: 'Objects' },
    { emoji: '📻', name: 'radio', category: 'Objects' },
    { emoji: '🎙️', name: 'studio_microphone', category: 'Objects' },
    { emoji: '🔋', name: 'battery', category: 'Objects' },
    { emoji: '💡', name: 'bulb', category: 'Objects' },
    { emoji: '🔦', name: 'flashlight', category: 'Objects' },
    { emoji: '🕯️', name: 'candle', category: 'Objects' },
    { emoji: '🔑', name: 'key', category: 'Objects' },
    { emoji: '🗝️', name: 'old_key', category: 'Objects' },
    { emoji: '🔒', name: 'lock', category: 'Objects' },
    { emoji: '🔓', name: 'unlock', category: 'Objects' },
    { emoji: '🔨', name: 'hammer', category: 'Objects' },
    { emoji: '⚙️', name: 'gear', category: 'Objects' },
    { emoji: '🔧', name: 'wrench', category: 'Objects' },
    { emoji: '🧲', name: 'magnet', category: 'Objects' },
    { emoji: '💊', name: 'pill', category: 'Objects' },
    { emoji: '🩹', name: 'adhesive_bandage', category: 'Objects' },
    { emoji: '🧬', name: 'dna', category: 'Objects' },
    { emoji: '🔭', name: 'telescope', category: 'Objects' },
    { emoji: '🔬', name: 'microscope', category: 'Objects' },
    { emoji: '📚', name: 'books', category: 'Objects' },
    { emoji: '📖', name: 'book', category: 'Objects' },
    { emoji: '📝', name: 'memo', category: 'Objects' },
    { emoji: '✏️', name: 'pencil2', category: 'Objects' },
    { emoji: '🖊️', name: 'pen', category: 'Objects' },
    { emoji: '📌', name: 'pushpin', category: 'Objects' },
    { emoji: '📎', name: 'paperclip', category: 'Objects' },
    { emoji: '✂️', name: 'scissors', category: 'Objects' },
    // Symbols
    { emoji: '❤️', name: 'heart', category: 'Symbols' },
    { emoji: '🧡', name: 'orange_heart', category: 'Symbols' },
    { emoji: '💛', name: 'yellow_heart', category: 'Symbols' },
    { emoji: '💚', name: 'green_heart', category: 'Symbols' },
    { emoji: '💙', name: 'blue_heart', category: 'Symbols' },
    { emoji: '💜', name: 'purple_heart', category: 'Symbols' },
    { emoji: '🖤', name: 'black_heart', category: 'Symbols' },
    { emoji: '🤍', name: 'white_heart', category: 'Symbols' },
    { emoji: '🤎', name: 'brown_heart', category: 'Symbols' },
    { emoji: '💔', name: 'broken_heart', category: 'Symbols' },
    { emoji: '❣️', name: 'heavy_heart_exclamation', category: 'Symbols' },
    { emoji: '💕', name: 'two_hearts', category: 'Symbols' },
    { emoji: '💞', name: 'revolving_hearts', category: 'Symbols' },
    { emoji: '💓', name: 'heartbeat', category: 'Symbols' },
    { emoji: '💗', name: 'heartpulse', category: 'Symbols' },
    { emoji: '💖', name: 'sparkling_heart', category: 'Symbols' },
    { emoji: '💘', name: 'cupid', category: 'Symbols' },
    { emoji: '💝', name: 'gift_heart', category: 'Symbols' },
    { emoji: '💟', name: 'heart_decoration', category: 'Symbols' },
    { emoji: '☮️', name: 'peace_symbol', category: 'Symbols' },
    { emoji: '✝️', name: 'latin_cross', category: 'Symbols' },
    { emoji: '☯️', name: 'yin_yang', category: 'Symbols' },
    { emoji: '♾️', name: 'infinity', category: 'Symbols' },
    { emoji: '✅', name: 'white_check_mark', category: 'Symbols' },
    { emoji: '❌', name: 'x', category: 'Symbols' },
    { emoji: '⭕', name: 'o', category: 'Symbols' },
    { emoji: '⛔', name: 'no_entry', category: 'Symbols' },
    { emoji: '🚫', name: 'no_entry_sign', category: 'Symbols' },
    { emoji: '💯', name: '100', category: 'Symbols' },
    { emoji: '🔞', name: 'underage', category: 'Symbols' },
    { emoji: '🆕', name: 'new', category: 'Symbols' },
    { emoji: '🆙', name: 'up', category: 'Symbols' },
    { emoji: '🆒', name: 'cool', category: 'Symbols' },
    { emoji: '🆓', name: 'free', category: 'Symbols' },
    { emoji: '🆚', name: 'vs', category: 'Symbols' },
    // Flags
    { emoji: '🏳️', name: 'white_flag', category: 'Flags' },
    { emoji: '🏴', name: 'black_flag', category: 'Flags' },
    { emoji: '🏁', name: 'checkered_flag', category: 'Flags' },
    { emoji: '🚩', name: 'triangular_flag_on_post', category: 'Flags' },
    { emoji: '🏳️‍🌈', name: 'rainbow_flag', category: 'Flags' },
    { emoji: '🇺🇸', name: 'us', category: 'Flags' },
    { emoji: '🇬🇧', name: 'gb', category: 'Flags' },
    { emoji: '🇨🇦', name: 'ca', category: 'Flags' },
    { emoji: '🇦🇺', name: 'au', category: 'Flags' },
    { emoji: '🇩🇪', name: 'de', category: 'Flags' },
    { emoji: '🇫🇷', name: 'fr', category: 'Flags' },
    { emoji: '🇯🇵', name: 'jp', category: 'Flags' },
    { emoji: '🇰🇷', name: 'kr', category: 'Flags' },
    { emoji: '🇨🇳', name: 'cn', category: 'Flags' },
    { emoji: '🇧🇷', name: 'br', category: 'Flags' },
    { emoji: '🇮🇳', name: 'in', category: 'Flags' },
    { emoji: '🇪🇸', name: 'es', category: 'Flags' },
    { emoji: '🇮🇹', name: 'it', category: 'Flags' },
    { emoji: '🇲🇽', name: 'mx', category: 'Flags' },
    { emoji: '🇷🇺', name: 'ru', category: 'Flags' },
    // Travel
    { emoji: '🚀', name: 'rocket', category: 'Travel' },
    { emoji: '✈️', name: 'airplane', category: 'Travel' },
    { emoji: '🚗', name: 'car', category: 'Travel' },
    { emoji: '🚕', name: 'taxi', category: 'Travel' },
    { emoji: '🚙', name: 'blue_car', category: 'Travel' },
    { emoji: '🚌', name: 'bus', category: 'Travel' },
    { emoji: '🚎', name: 'trolleybus', category: 'Travel' },
    { emoji: '🏎️', name: 'racing_car', category: 'Travel' },
    { emoji: '🚓', name: 'police_car', category: 'Travel' },
    { emoji: '🚒', name: 'fire_engine', category: 'Travel' },
    { emoji: '🚐', name: 'minibus', category: 'Travel' },
    { emoji: '🚑', name: 'ambulance', category: 'Travel' },
    { emoji: '🚂', name: 'steam_locomotive', category: 'Travel' },
    { emoji: '🚢', name: 'ship', category: 'Travel' },
    { emoji: '⛵', name: 'sailboat', category: 'Travel' },
    { emoji: '🚲', name: 'bike', category: 'Travel' },
    { emoji: '🛵', name: 'motor_scooter', category: 'Travel' },
    { emoji: '🏠', name: 'house', category: 'Travel' },
    { emoji: '🏙️', name: 'cityscape', category: 'Travel' },
    { emoji: '🗼', name: 'tokyo_tower', category: 'Travel' },
    { emoji: '🗽', name: 'statue_of_liberty', category: 'Travel' },
    { emoji: '🏰', name: 'european_castle', category: 'Travel' },
    { emoji: '🗿', name: 'moyai', category: 'Travel' },
    { emoji: '⛺', name: 'tent', category: 'Travel' },
    { emoji: '🌋', name: 'volcano', category: 'Travel' },
    { emoji: '🏝️', name: 'desert_island', category: 'Travel' },
  ];

  const CATEGORIES = ['Smileys', 'People', 'Nature', 'Food', 'Activities', 'Travel', 'Objects', 'Symbols', 'Flags'] as const;
  const CATEGORY_ICONS: Record<string, string> = {
    'Smileys': '😀', 'People': '👋', 'Nature': '🌿', 'Food': '🍕',
    'Activities': '🎮', 'Travel': '🚀', 'Objects': '💻', 'Symbols': '❤️', 'Flags': '🏳️',
  };

  let searchQuery = $state('');
  let activeSection = $state<'frequent' | 'custom-server' | 'custom-user' | string>('frequent');
  let hoveredEmoji = $state<{ emoji: string; name: string } | null>(null);
  let serverEmojis = $state<CustomEmoji[]>([]);
  let frequentEmojis = $state<string[]>([]);

  interface LocalEmojiEntry { id: string; name: string; blob: Blob; }
  let localEmojis = $state<LocalEmojiEntry[]>([]);

  // Load server emojis and local emojis
  $effect(() => {
    if (serverId) {
      api.get<CustomEmoji[]>(`/servers/${serverId}/emojis`).then(r => { serverEmojis = r; }).catch(() => {});
    }
    getLocalEmojis().then(r => { localEmojis = r; }).catch(() => {});
    // Load frequently used from localStorage
    try {
      const stored = localStorage.getItem('harmony:frequent-emojis');
      if (stored) frequentEmojis = JSON.parse(stored).slice(0, 30);
    } catch {}
  });

  function addToFrequent(emoji: string) {
    const updated = [emoji, ...frequentEmojis.filter(e => e !== emoji)].slice(0, 30);
    frequentEmojis = updated;
    localStorage.setItem('harmony:frequent-emojis', JSON.stringify(updated));
  }

  const filteredUnicode = $derived(
    searchQuery
      ? UNICODE_EMOJIS.filter(e =>
          e.name.includes(searchQuery.toLowerCase()) || e.emoji.includes(searchQuery)
        )
      : UNICODE_EMOJIS
  );

  const filteredServer = $derived(
    searchQuery
      ? serverEmojis.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : serverEmojis
  );

  function handleSelectUnicode(e: UnicodeEmoji) {
    addToFrequent(e.emoji);
    onselect({ unicode: e.emoji });
  }

  function handleSelectCustom(e: CustomEmoji) {
    onselect({ custom: e });
  }

  function handleSelectLocal(e: LocalEmojiEntry) {
    onselect({ local: e });
  }

  async function handleUploadEmoji(evt: Event) {
    const input = evt.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const id = `local-emoji-${Date.now()}`;
    const name = file.name.replace(/\.[^.]+$/, '');
    await saveLocalEmoji(id, name, file);
    localEmojis = await getLocalEmojis();
    input.value = '';
  }

  // Click outside handler
  let containerEl = $state<HTMLDivElement | undefined>(undefined);

  function handleClickOutside(e: MouseEvent) {
    if (containerEl && !containerEl.contains(e.target as Node)) {
      onclose?.();
    }
  }

  $effect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  });
</script>

<div
  bind:this={containerEl}
  class="
    flex flex-col w-80 h-96 rounded-lg bg-bg-floating shadow-2xl border border-divider
    overflow-hidden select-none
  "
  role="dialog"
  aria-label="Emoji picker"
>
  <!-- Search bar -->
  <div class="px-2 pt-2 pb-1 shrink-0">
    <div class="relative">
      <svg
        class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
        width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
      >
        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
      </svg>
      <input
        type="search"
        placeholder="Search emojis..."
        bind:value={searchQuery}
        class="
          w-full pl-8 pr-3 py-1.5 rounded bg-bg-input text-sm
          text-text-primary placeholder:text-text-muted
          border border-transparent focus:border-brand focus:outline-none
        "
        aria-label="Search emojis"
      />
    </div>
  </div>

  <!-- Category tabs (icon row) -->
  {#if !searchQuery}
    <div class="flex items-center gap-0.5 px-2 pb-1 shrink-0 overflow-x-auto">
      <!-- Frequently used -->
      {#if frequentEmojis.length > 0}
        <button
          onclick={() => activeSection = 'frequent'}
          title="Frequently Used"
          class="
            p-1.5 rounded text-base transition-colors
            {activeSection === 'frequent' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
          "
        >🕐</button>
      {/if}
      <!-- Server emojis -->
      {#if serverEmojis.length > 0}
        <button
          onclick={() => activeSection = 'custom-server'}
          title="Server Emojis"
          class="
            p-1.5 rounded text-base transition-colors
            {activeSection === 'custom-server' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
          "
        >🖼️</button>
      {/if}
      <!-- My emojis -->
      <button
        onclick={() => activeSection = 'custom-user'}
        title="My Emojis"
        class="
          p-1.5 rounded text-base transition-colors
          {activeSection === 'custom-user' ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
        "
      >⭐</button>
      <!-- Unicode categories -->
      {#each CATEGORIES as cat (cat)}
        <button
          onclick={() => activeSection = cat}
          title={cat}
          class="
            p-1.5 rounded text-base transition-colors
            {activeSection === cat ? 'bg-bg-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'}
          "
        >{CATEGORY_ICONS[cat]}</button>
      {/each}
    </div>
  {/if}

  <!-- Emoji grid -->
  <div class="flex-1 overflow-y-auto px-2 pb-2">
    {#if searchQuery}
      <!-- Search results -->
      <p class="text-xs text-text-muted font-semibold uppercase tracking-wide pt-2 pb-1">
        Results ({filteredUnicode.length + filteredServer.length})
      </p>
      <div class="grid grid-cols-8 gap-0.5">
        {#each filteredServer as e (e.id)}
          <button
            onclick={() => handleSelectCustom(e)}
            onmouseenter={() => hoveredEmoji = { emoji: '', name: e.name }}
            onmouseleave={() => hoveredEmoji = null}
            title={e.name}
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-bg-hover transition-colors"
          >
            <img src={e.url} alt={e.name} class="w-6 h-6 object-contain" />
          </button>
        {/each}
        {#each filteredUnicode as e (`${e.emoji}${e.category}`)}
          <button
            onclick={() => handleSelectUnicode(e)}
            onmouseenter={() => hoveredEmoji = { emoji: e.emoji, name: e.name }}
            onmouseleave={() => hoveredEmoji = null}
            title={e.name}
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-bg-hover text-xl transition-colors"
          >{e.emoji}</button>
        {/each}
      </div>
    {:else if activeSection === 'frequent'}
      <p class="text-xs text-text-muted font-semibold uppercase tracking-wide pt-2 pb-1">Frequently Used</p>
      <div class="grid grid-cols-8 gap-0.5">
        {#each frequentEmojis as emoji, i (i)}
          <button
            onclick={() => onselect({ unicode: emoji })}
            onmouseenter={() => hoveredEmoji = { emoji, name: emoji }}
            onmouseleave={() => hoveredEmoji = null}
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-bg-hover text-xl transition-colors"
          >{emoji}</button>
        {/each}
      </div>
    {:else if activeSection === 'custom-server'}
      <p class="text-xs text-text-muted font-semibold uppercase tracking-wide pt-2 pb-1">Server Emojis</p>
      <div class="grid grid-cols-8 gap-0.5">
        {#each serverEmojis as e (e.id)}
          <button
            onclick={() => handleSelectCustom(e)}
            onmouseenter={() => hoveredEmoji = { emoji: '', name: e.name }}
            onmouseleave={() => hoveredEmoji = null}
            title={e.name}
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-bg-hover transition-colors"
          >
            <img src={e.url} alt={e.name} class="w-6 h-6 object-contain" />
          </button>
        {/each}
      </div>
    {:else if activeSection === 'custom-user'}
      <p class="text-xs text-text-muted font-semibold uppercase tracking-wide pt-2 pb-1">My Emojis</p>
      <!-- Upload -->
      <label class="flex items-center gap-1.5 px-2 py-1.5 mb-1 rounded border border-dashed border-divider hover:border-brand text-xs text-text-muted hover:text-brand cursor-pointer transition-colors">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Upload emoji
        <input type="file" accept="image/*" class="sr-only" onchange={handleUploadEmoji} />
      </label>
      <div class="grid grid-cols-8 gap-0.5">
        {#each localEmojis as e (e.id)}
          <button
            onclick={() => handleSelectLocal(e)}
            onmouseenter={() => hoveredEmoji = { emoji: '', name: e.name }}
            onmouseleave={() => hoveredEmoji = null}
            title={e.name}
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-bg-hover transition-colors"
          >
            <img src={URL.createObjectURL(e.blob)} alt={e.name} class="w-6 h-6 object-contain rounded-sm" />
          </button>
        {/each}
      </div>
    {:else}
      <!-- Single unicode category -->
      {@const categoryEmojis = UNICODE_EMOJIS.filter(e => e.category === activeSection)}
      <p class="text-xs text-text-muted font-semibold uppercase tracking-wide pt-2 pb-1">{activeSection}</p>
      <div class="grid grid-cols-8 gap-0.5">
        {#each categoryEmojis as e (`${e.emoji}${e.category}`)}
          <button
            onclick={() => handleSelectUnicode(e)}
            onmouseenter={() => hoveredEmoji = { emoji: e.emoji, name: e.name }}
            onmouseleave={() => hoveredEmoji = null}
            class="w-9 h-9 flex items-center justify-center rounded hover:bg-bg-hover text-xl transition-colors"
          >{e.emoji}</button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Hover preview footer -->
  <div class="shrink-0 h-9 px-3 flex items-center gap-2 border-t border-divider bg-bg-tertiary">
    {#if hoveredEmoji}
      {#if hoveredEmoji.emoji}
        <span class="text-xl">{hoveredEmoji.emoji}</span>
      {/if}
      <span class="text-xs text-text-secondary">:{hoveredEmoji.name}:</span>
    {:else}
      <span class="text-xs text-text-muted">Hover an emoji to preview</span>
    {/if}
  </div>
</div>
