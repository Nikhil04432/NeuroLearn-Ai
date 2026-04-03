'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SkillLevelSettingsProps {
  currentLevel: string;
  onLevelChange?: (newLevel: string) => void;
}

export function SkillLevelSettings({ currentLevel, onLevelChange }: SkillLevelSettingsProps) {
  const [selectedLevel, setSelectedLevel] = useState(currentLevel || 'BEGINNER');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (selectedLevel === currentLevel) {
      toast.info('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skillLevel: selectedLevel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update skill level');
      }

      toast.success('Skill level updated successfully!');
      onLevelChange?.(selectedLevel);
    } catch (error) {
      console.error('Error updating skill level:', error);
      toast.error('Failed to update skill level. Please try again.');
      setSelectedLevel(currentLevel);
    } finally {
      setSaving(false);
    }
  };

  const levelDescriptions = {
    BEGINNER: {
      icon: '🌱',
      title: 'Beginner',
      description: 'Just starting your coding journey. Learning fundamentals and basic concepts.',
    },
    INTERMEDIATE: {
      icon: '📈',
      title: 'Intermediate',
      description: 'Comfortable with basics. Working on building real projects and expanding skills.',
    },
    ADVANCED: {
      icon: '🚀',
      title: 'Advanced',
      description: 'Experienced developer. Looking to master advanced patterns and specialized skills.',
    },
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Coding Experience Level
          </CardTitle>
          <CardDescription>
            Your level helps us recommend appropriate skills in job descriptions. You can update this anytime.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={selectedLevel} onValueChange={setSelectedLevel}>
          <div className="space-y-4">
            {(['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const).map((level) => (
              <div
                key={level}
                className="relative flex items-start space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedLevel(level)}
              >
                <RadioGroupItem value={level} id={level} className="mt-1" />
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={level}
                    className="text-base font-semibold cursor-pointer flex items-center gap-2"
                  >
                    <span>{levelDescriptions[level as keyof typeof levelDescriptions].icon}</span>
                    {levelDescriptions[level as keyof typeof levelDescriptions].title}
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {levelDescriptions[level as keyof typeof levelDescriptions].description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </RadioGroup>

        {/* Impact Info */}
        <div className="bg-muted p-3 rounded-lg space-y-2">
          <p className="text-sm font-semibold">Why this matters:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Extension shows appropriate skills for job descriptions</li>
            <li>Recommended learning paths start at the right difficulty level</li>
            <li>Prerequisites are filtered to match your experience</li>
          </ul>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving || selectedLevel === currentLevel}
          className="w-full"
        >
          {saving ? 'Saving...' : selectedLevel === currentLevel ? 'No Changes' : 'Save Level'}
        </Button>
      </CardContent>
    </Card>
  );
}
