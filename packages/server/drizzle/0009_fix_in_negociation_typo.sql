-- Fix typo: in-negociation -> in-negotiation
UPDATE deals SET stage = 'in-negotiation' WHERE stage = 'in-negociation';
