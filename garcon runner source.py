import pygame
import random
import sys

# Configuration de base
WIDTH = 800
HEIGHT = 400
FPS = 60
GROUND_Y = 300

# Couleurs
WHITE = (255, 255, 255)
SKY_BLUE = (135, 206, 235)
BROWN = (139, 69, 19)
GREEN = (34, 139, 34)
GOLD = (255, 215, 0)
RED = (204, 0, 0)
BLACK = (0, 0, 0)

class Game:
    def __init__(self):
        pygame.init()
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Petit Garçon Runner")
        self.clock = pygame.time.Clock()
        self.font = pygame.font.SysFont("Arial", 24, bold=True)
        
        # État du joueur
        self.player_y = GROUND_Y
        self.player_velocity = 0
        self.gravity = 0.6
        self.jump_strength = -15
        self.is_jumping = False
        
        # Score et Argent
        self.score = 0
        self.money = 0
        self.game_over = False
        self.frame_count = 0
        
        # Listes d'objets
        self.obstacles = []
        self.collectibles = []
        
    def spawn_obstacle(self):
        if self.frame_count % 100 == 0:
            self.obstacles.append([WIDTH, GROUND_Y - 30])
            
    def spawn_collectible(self):
        if self.frame_count % 150 == 0:
            types = ['coin', 'bill', 'donut']
            c_type = random.choice(types)
            self.collectibles.append({'x': WIDTH, 'y': GROUND_Y - 50, 'type': c_type})

    def update(self):
        if self.game_over:
            return

        self.frame_count += 1
        if self.frame_count % 10 == 0:
            self.score += 1

        # Physique du joueur
        self.player_velocity += self.gravity
        self.player_y += self.player_velocity
        if self.player_y > GROUND_Y:
            self.player_y = GROUND_Y
            self.player_velocity = 0
            self.is_jumping = False

        # Mise à jour obstacles
        for obs in self.obstacles[:]:
            obs[0] -= 8
            # Collision
            player_rect = pygame.Rect(50, self.player_y - 40, 40, 40)
            obs_rect = pygame.Rect(obs[0], obs[1], 30, 30)
            if player_rect.colliderect(obs_rect):
                self.game_over = True
            if obs[0] < -50:
                self.obstacles.remove(obs)

        # Mise à jour collectibles
        for col in self.collectibles[:]:
            col['x'] -= 8
            col_rect = pygame.Rect(col['x'], col['y'], 20, 20)
            player_rect = pygame.Rect(50, self.player_y - 40, 40, 40)
            
            if player_rect.colliderect(col_rect):
                if col['type'] == 'coin': self.money += 15
                elif col['type'] == 'bill': self.money += 50
                elif col['type'] == 'donut': self.score += 10
                self.collectibles.remove(col)
            elif col['x'] < -50:
                self.collectibles.remove(col)

        self.spawn_obstacle()
        self.spawn_collectible()

    def draw(self):
        self.screen.fill(SKY_BLUE)
        
        # Sol
        pygame.draw.rect(self.screen, (100, 100, 100), (0, GROUND_Y + 5, WIDTH, HEIGHT - GROUND_Y))

        # Joueur (Le petit garçon sans moustache)
        # Corps
        pygame.draw.rect(self.screen, (255, 107, 107), (38, self.player_y, 24, 20))
        # Tête
        pygame.draw.circle(self.screen, (255, 212, 163), (50, int(self.player_y - 18)), 11)
        
        # Cheveux (fixés sur le dessus)
        pygame.draw.circle(self.screen, (92, 64, 51), (50, int(self.player_y - 24)), 11)
        # On redessine le bas de la tête pour que les cheveux ne couvrent pas tout le visage
        pygame.draw.rect(self.screen, (255, 212, 163), (39, self.player_y - 18, 22, 11))

        # Yeux
        pygame.draw.circle(self.screen, BLACK, (46, int(self.player_y - 19)), 2)
        pygame.draw.circle(self.screen, BLACK, (54, int(self.player_y - 19)), 2)

        # Obstacles (Arbres)
        for obs in self.obstacles:
            pygame.draw.rect(self.screen, BROWN, (obs[0] + 8, obs[1], 14, 30))
            pygame.draw.circle(self.screen, GREEN, (obs[0] + 15, obs[1] - 10), 18)

        # Collectibles
        for col in self.collectibles:
            color = GOLD if col['type'] == 'coin' else GREEN if col['type'] == 'bill' else (210, 105, 30)
            pygame.draw.circle(self.screen, color, (int(col['x']), int(col['y'])), 10)

        # UI
        score_text = self.font.render(f"Score: {self.score}", True, BLACK)
        money_text = self.font.render(f"Argent: {self.money}", True, BLACK)
        self.screen.blit(score_text, (10, 10))
        self.screen.blit(money_text, (10, 40))

        if self.game_over:
            over_text = self.font.render("GAME OVER! Appuyez sur R", True, RED)
            self.screen.blit(over_text, (WIDTH//2 - 100, HEIGHT//2))

        pygame.display.flip()

    def run(self):
        while True:
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    pygame.quit()
                    sys.exit()
                if event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_SPACE and not self.is_jumping and not self.game_over:
                        self.player_velocity = self.jump_strength
                        self.is_jumping = True
                    if event.key == pygame.K_r and self.game_over:
                        self.__init__()

            self.update()
            self.draw()
            self.clock.tick(FPS)

if __name__ == "__main__":
    Game().run()
