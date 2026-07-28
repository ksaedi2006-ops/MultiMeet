from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/groups", tags=["groups"])


@router.post("", response_model=schemas.GroupOut)
def create_group(payload: schemas.GroupCreate, admin_user_id: str, db: Session = Depends(get_db)):
    group = models.Group(name=payload.name, type=payload.type, default_duration=payload.default_duration)
    db.add(group)
    db.commit()
    db.refresh(group)

    db.add(models.GroupMember(group_id=group.id, user_id=admin_user_id, role="admin"))
    db.commit()
    return group


@router.get("/{group_id}", response_model=schemas.GroupOut)
def get_group(group_id: str, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.post("/join/{invite_code}", response_model=schemas.GroupOut)
def join_group(invite_code: str, user_id: str, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(models.Group.invite_code == invite_code).first()
    if not group:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    existing = (
        db.query(models.GroupMember)
        .filter(models.GroupMember.group_id == group.id, models.GroupMember.user_id == user_id)
        .first()
    )
    if not existing:
        db.add(models.GroupMember(group_id=group.id, user_id=user_id, role="member"))
        db.commit()
    return group


@router.get("/{group_id}/members")
def list_members(group_id: str, db: Session = Depends(get_db)):
    members = db.query(models.GroupMember).filter(models.GroupMember.group_id == group_id).all()
    result = []
    for m in members:
        user = db.query(models.User).filter(models.User.id == m.user_id).first()
        result.append({"user_id": m.user_id, "name": user.name if user else None, "role": m.role})
    return result
